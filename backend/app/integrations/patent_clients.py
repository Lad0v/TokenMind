"""
Базовые HTTP клиенты для работы с внешними патентными API.

Реализует:
- Базовый клиент с retry/backoff логикой
- Rate limiting
- Аудит вызовов
- Маппинг ответов в нормализованные DTO
"""

import asyncio
import hashlib
import logging
import time
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypeVar

import httpx
from pydantic import BaseModel
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    retry_if_result,
)

from app.core.config import settings
from app.schemas.ip_intel import NormalizedPatentRecord, ExternalApiCallResult

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


# =============================================================================
# Базовый HTTP клиент с retry/backoff
# =============================================================================

class BasePatentClient(ABC):
    """
    Базовый класс для всех клиентов патентных API.
    
    Реализует:
    - Retry с экспоненциальной задержкой для 429 и 5xx
    - Rate limiting
    - Логирование и аудит
    - Базовую авторизацию
    """
    
    SOURCE_NAME: str = "UNKNOWN"
    BASE_URL: str = ""
    CACHE_TTL_HOURS: int = 48  # По умолчанию 48 часов
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        consumer_key: Optional[str] = None,
        consumer_secret: Optional[str] = None,
        timeout: float = 30.0,
        rate_limit_calls: int = 10,
        rate_limit_period: float = 1.0,
    ):
        self.api_key = api_key
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret
        self.timeout = timeout
        self.rate_limit_calls = rate_limit_calls
        self.rate_limit_period = rate_limit_period
        
        # Rate limiting через простой semaphore + queue
        self._rate_limit_semaphore = asyncio.Semaphore(rate_limit_calls)
        self._last_request_time: Optional[float] = None
        
        # HTTP клиент
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Получение HTTP клиента с настроенными заголовками."""
        if self._client is None or self._client.is_closed:
            headers = await self._get_auth_headers()
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers=headers,
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            )
        return self._client
    
    async def _get_auth_headers(self) -> Dict[str, str]:
        """Получение заголовков авторизации. Переопределяется в подклассах."""
        return {"Accept": "application/json"}
    
    async def close(self):
        """Закрытие HTTP клиента."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
    
    async def _apply_rate_limit(self):
        """Применение rate limiting."""
        async with self._rate_limit_semaphore:
            if self._last_request_time:
                elapsed = time.time() - self._last_request_time
                if elapsed < self.rate_limit_period:
                    await asyncio.sleep(self.rate_limit_period - elapsed)
            self._last_request_time = time.time()
    
    @staticmethod
    def _generate_request_id() -> str:
        """Генерация уникального ID запроса."""
        return str(uuid.uuid4())
    
    def _log_api_call(
        self,
        endpoint: str,
        status_code: Optional[int],
        latency_ms: float,
        request_id: str,
        error: Optional[str] = None,
    ):
        """Логирование вызова API (без PII)."""
        log_data = {
            "source": self.SOURCE_NAME,
            "endpoint": endpoint,
            "status_code": status_code,
            "latency_ms": round(latency_ms, 2),
            "request_id": request_id,
        }
        if error:
            log_data["error"] = error
            logger.warning("External API call failed: %s", log_data)
        else:
            logger.info("External API call: %s", log_data)
    
    async def _audit_api_call(
        self,
        db_session: Any,
        endpoint: str,
        status_code: Optional[int],
        latency_ms: float,
        request_id: str,
        patent_number: Optional[str] = None,
        error: Optional[str] = None,
    ):
        """Запись аудита вызова внешнего API."""
        # TODO: Импортировать AuditService и записать в audit_logs
        # from app.services.audit_service import AuditService
        # payload = {
        #     "endpoint": endpoint,
        #     "source": self.SOURCE_NAME,
        #     "status_code": status_code,
        #     "latency_ms": round(latency_ms, 2),
        #     "request_id": request_id,
        # }
        # if patent_number:
        #     payload["patent_number"] = patent_number
        # if error:
        #     payload["error"] = error
        # await AuditService.write(
        #     db=db_session,
        #     action="EXTERNAL_API_CALL",
        #     entity_type="external_api",
        #     entity_id=request_id,
        #     payload=payload,
        # )
        pass
    
    @retry(
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError))
        | retry_if_result(lambda r: r.status_code in {429, 500, 502, 503, 504}),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def _request_with_retry(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        """HTTP запрос с retry/backoff логикой."""
        await self._apply_rate_limit()
        client = await self._get_client()
        
        request_id = self._generate_request_id()
        start_time = time.time()
        
        try:
            response = await client.request(
                method=method,
                url=endpoint,
                params=params,
                json=json_body,
            )
            latency_ms = (time.time() - start_time) * 1000
            
            self._log_api_call(endpoint, response.status_code, latency_ms, request_id)
            
            return response
            
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            self._log_api_call(endpoint, None, latency_ms, request_id, error=str(e))
            raise
    
    async def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        """GET запрос с retry."""
        return await self._request_with_retry("GET", endpoint, params=params)
    
    async def post(
        self,
        endpoint: str,
        json_body: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        """POST запрос с retry."""
        return await self._request_with_retry("POST", endpoint, json_body=json_body)
    
    @abstractmethod
    async def fetch_patent_by_number(
        self,
        patent_number: str,
        country_code: str,
        kind_code: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """Получение патента по номеру. Реализуется в подклассах."""
        pass
    
    @abstractmethod
    async def search_patents(
        self,
        query: str,
        page: int = 1,
        per_page: int = 20,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """Поиск патентов. Реализуется в подклассах."""
        pass
    
    @abstractmethod
    def _map_to_normalized_record(self, data: Dict[str, Any]) -> Optional[NormalizedPatentRecord]:
        """Маппинг ответа API в нормализованную запись. Реализуется в подклассах."""
        pass
    
    @staticmethod
    def _normalize_status(raw_status: Optional[str]) -> str:
        """Нормализация статуса патента."""
        if not raw_status:
            return "unknown"

        raw_lower = raw_status.lower()

        # USPTO статусы
        if any(kw in raw_lower for kw in ("grant", "patented", "active")):
            return "granted"
        if any(kw in raw_lower for kw in ("abandon", "expire")):
            return "expired"
        if any(kw in raw_lower for kw in ("pending", "application")):
            return "pending"
        if "revok" in raw_lower:
            return "revoked"
        if "under_review" in raw_lower or "under review" in raw_lower:
            return "pending"

        return "unknown"


# =============================================================================
# USPTO Patent API Client
# =============================================================================

class UsptoPatentClient(BasePatentClient):
    """
    Клиент для USPTO Open Data Portal v2.3.

    API documentation: https://data.uspto.gov/swagger/index.html
    Требуется API key (X-API-Key header).

    Endpoints:
      - GET  /api/v1/patent/grants?patentNumber={number}
      - POST /api/v1/patent/applications/search
      - GET  /api/v1/patent/applications/{applicationNumber}/continuity
    """

    SOURCE_NAME = "USPTO"
    BASE_URL = "https://data.uspto.gov"
    CACHE_TTL_HOURS = 72

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(
            api_key=api_key or getattr(settings, "USPTO_API_KEY", None),
            timeout=getattr(settings, "EXTERNAL_API_TIMEOUT", 30.0),
            rate_limit_calls=5,
            rate_limit_period=1.0 / 5,  # 5 calls/sec → 0.2s between calls
        )

    async def _get_auth_headers(self) -> Dict[str, str]:
        headers = await super()._get_auth_headers()
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    # ------------------------------------------------------------------
    # Public API: fetch_patent_by_number
    # ------------------------------------------------------------------

    async def fetch_patent_by_number(
        self,
        patent_number: str,
        country_code: str = "US",
        kind_code: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """
        Получение данных патента USPTO по номеру.

        Стратегия:
          1. Пробуем GET /api/v1/patent/grants?patentNumber={number}
          2. Если не найдено — POST /api/v1/patent/applications/search
          3. Для applications дополнительно GET continuity для статуса
        """
        request_id = self._generate_request_id()
        clean_number = self._normalize_patent_number(patent_number)

        # --- Шаг 1: Поиск среди выданных патентов (grants) ---
        try:
            result = await self._fetch_grant_by_number(clean_number, request_id)
            if result.success and result.data:
                return result
        except Exception as e:
            logger.debug(f"USPTO grant fetch failed for {clean_number}: {e}")

        # --- Шаг 2: Поиск среди заявок (applications) ---
        try:
            result = await self._fetch_application_by_number(clean_number, request_id)
            return result
        except Exception as e:
            latency_ms = 0.0
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                latency_ms=latency_ms,
                error_message=f"Both grant and application lookups failed: {e}",
                request_id=request_id,
            )

    # ------------------------------------------------------------------
    # Internal: Grant lookup
    # ------------------------------------------------------------------

    async def _fetch_grant_by_number(
        self,
        clean_number: str,
        request_id: str,
    ) -> ExternalApiCallResult:
        """Поиск выданного патента через GET /api/v1/patent/grants."""
        start_time = time.time()

        endpoint = "/api/v1/patent/grants"
        response = await self.get(endpoint, params={"patentNumber": clean_number})
        latency_ms = (time.time() - start_time) * 1000

        if response.status_code == 404:
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                status_code=404,
                latency_ms=latency_ms,
                error_message="Patent not found in grants",
                request_id=request_id,
            )

        response.raise_for_status()
        data = response.json()

        # USPTO v2.3 returns: {"results": [...], "total": N}
        results = data.get("results", [])
        if not results:
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                status_code=404,
                latency_ms=latency_ms,
                error_message="Patent not found in grants (empty results)",
                request_id=request_id,
            )

        patent_data = results[0]
        return ExternalApiCallResult(
            source=self.SOURCE_NAME,
            success=True,
            status_code=response.status_code,
            latency_ms=latency_ms,
            data=patent_data,
            request_id=request_id,
        )

    # ------------------------------------------------------------------
    # Internal: Application lookup
    # ------------------------------------------------------------------

    async def _fetch_application_by_number(
        self,
        clean_number: str,
        request_id: str,
    ) -> ExternalApiCallResult:
        """Поиск заявки через POST /api/v1/patent/applications/search."""
        start_time = time.time()

        endpoint = "/api/v1/patent/applications/search"
        json_body = {
            "query": {"_or": [{"patentNumber": clean_number}]},
            "fields": [
                "applicationNumber",
                "patentNumber",
                "inventionTitle",
                "abstractText",
                "filingDate",
                "publicationDate",
                "grantDate",
                "status",
                "kindCode",
                "cpcClasses",
                "uspcClasses",
                "ipcClasses",
                "assignees",
                "inventors",
            ],
            "pagination": {"offset": 0, "limit": 25},
        }

        response = await self.post(endpoint, json_body=json_body)
        latency_ms = (time.time() - start_time) * 1000

        if response.status_code == 404:
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                status_code=404,
                latency_ms=latency_ms,
                error_message="Patent not found in applications",
                request_id=request_id,
            )

        response.raise_for_status()
        data = response.json()

        results = data.get("results", [])
        if not results:
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                status_code=404,
                latency_ms=latency_ms,
                error_message="Patent not found in applications (empty results)",
                request_id=request_id,
            )

        patent_data = results[0]

        # Дополнительно: получаем continuity для статуса
        app_number = patent_data.get("applicationNumber")
        if app_number:
            try:
                continuity = await self._fetch_continuity(app_number, request_id)
                if continuity:
                    patent_data["_continuity"] = continuity
            except Exception as e:
                logger.debug(f"Failed to fetch continuity for {app_number}: {e}")

        return ExternalApiCallResult(
            source=self.SOURCE_NAME,
            success=True,
            status_code=response.status_code,
            latency_ms=latency_ms,
            data=patent_data,
            request_id=request_id,
        )

    async def _fetch_continuity(
        self,
        application_number: str,
        request_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Получение информации о правопреемстве заявки."""
        try:
            endpoint = f"/api/v1/patent/applications/{application_number}/continuity"
            response = await self.get(endpoint)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.debug(f"Continuity fetch failed for {application_number}: {e}")
        return None

    # ------------------------------------------------------------------
    # Public API: search_patents
    # ------------------------------------------------------------------

    async def search_patents(
        self,
        query: str,
        page: int = 1,
        per_page: int = 20,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """
        Поиск патентов USPTO.

        Использует POST /api/v1/patent/applications/search для applications
        и GET /api/v1/patent/grants для grants.
        """
        request_id = self._generate_request_id()
        start_time = time.time()

        try:
            offset = (page - 1) * per_page

            # Формируем query для grants (поиск по ключевым словам)
            grants_endpoint = "/api/v1/patent/grants"
            params: Dict[str, Any] = {
                "q": query,
                "offset": offset,
                "limit": per_page,
            }
            if date_from:
                params["filingDate"] = f"[{date_from} TO *]"
            if date_to:
                params["filingDate"] = f"[* TO {date_to}]"
            if date_from and date_to:
                params["filingDate"] = f"[{date_from} TO {date_to}]"

            response = await self.get(grants_endpoint, params=params)
            latency_ms = (time.time() - start_time) * 1000

            if response.status_code == 404:
                return ExternalApiCallResult(
                    source=self.SOURCE_NAME,
                    success=True,
                    status_code=200,
                    latency_ms=latency_ms,
                    data={"results": [], "total": 0},
                    request_id=request_id,
                )

            response.raise_for_status()
            data = response.json()

            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=True,
                status_code=response.status_code,
                latency_ms=latency_ms,
                data=data,
                request_id=request_id,
            )

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                latency_ms=latency_ms,
                error_message=str(e),
                request_id=request_id,
            )

    # ------------------------------------------------------------------
    # Normalization
    # ------------------------------------------------------------------

    def _map_to_normalized_record(self, data: Dict[str, Any]) -> Optional[NormalizedPatentRecord]:
        """Маппинг ответа USPTO в нормализованную запись."""
        if not data:
            return None

        patent_number = data.get("patentNumber") or data.get("applicationNumber", "")
        kind_code = data.get("kindCode") or data.get("kind_code")

        # Статус: continuity имеет приоритет над основным статусом
        raw_status = data.get("status")
        continuity = data.pop("_continuity", None)
        if continuity:
            continuity_status = continuity.get("status")
            if continuity_status:
                raw_status = continuity_status

        # CPC / USPC / IPC классы
        cpc_classes = self._extract_classes(data.get("cpcClasses"))
        uspc_classes = self._extract_classes(data.get("uspcClasses"))
        ipc_classes = self._extract_classes(data.get("ipcClasses"))

        return NormalizedPatentRecord(
            source="USPTO",
            source_id=patent_number,
            country_code="US",
            kind_code=kind_code,
            title=data.get("inventionTitle") or data.get("title") or "Unknown",
            abstract=data.get("abstractText") or data.get("abstract") or data.get("briefSummary"),
            filing_date=data.get("filingDate"),
            publication_date=data.get("publicationDate"),
            grant_date=data.get("grantDate"),
            status=self._normalize_status(raw_status),
            assignees=self._parse_assignees(data.get("assignees", [])),
            inventors=self._parse_inventors(data.get("inventors", [])),
            cpc_classes=cpc_classes,
            uspc_classes=uspc_classes,
            ipc_classes=ipc_classes,
            citations_count=data.get("citationsCount"),
            raw_data=data,
        )

    @staticmethod
    def _normalize_patent_number(patent_number: str) -> str:
        """Нормализация номера патента для USPTO API."""
        return patent_number.replace(",", "").replace(" ", "").replace("-", "")

    @staticmethod
    def _extract_classes(raw: Any) -> Optional[List[str]]:
        """Извлечение классификационных классов в список строк."""
        if not raw:
            return None
        if isinstance(raw, list):
            # Может быть список строк или объектов
            result = []
            for item in raw:
                if isinstance(item, str):
                    result.append(item)
                elif isinstance(item, dict):
                    code = item.get("classificationSymbol") or item.get("code") or item.get("class")
                    if code:
                        result.append(code)
            return result if result else None
        if isinstance(raw, str):
            return [raw]
        return None

    @staticmethod
    def _parse_assignees(raw_assignees: Any) -> List[Dict[str, Optional[str]]]:
        """Парсинг правообладателей из USPTO формата."""
        if not raw_assignees:
            return []

        assignees = []
        for a in raw_assignees if isinstance(raw_assignees, list) else [raw_assignees]:
            if isinstance(a, str):
                assignees.append({"name": a, "type": None, "country": None})
            elif isinstance(a, dict):
                assignees.append({
                    "name": a.get("name") or a.get("assigneeName") or a.get("lastName"),
                    "type": a.get("type") or a.get("assigneeType"),
                    "country": a.get("country"),
                })
        return assignees

    @staticmethod
    def _parse_inventors(raw_inventors: Any) -> List[Dict[str, Optional[str]]]:
        """Парсинг изобретателей из USPTO формата."""
        if not raw_inventors:
            return []

        inventors = []
        for i in raw_inventors if isinstance(raw_inventors, list) else [raw_inventors]:
            if isinstance(i, str):
                inventors.append({"name": i, "country": None})
            elif isinstance(i, dict):
                inventors.append({
                    "name": i.get("name") or i.get("inventorName") or i.get("lastName"),
                    "country": i.get("country"),
                })
        return inventors


# =============================================================================
# PatentsView API Client
# =============================================================================

class PatentsViewClient(BasePatentClient):
    """
    Клиент для PatentsView API.
    
    API documentation: https://api.patentsview.org/
    Не требует авторизации.
    """
    
    SOURCE_NAME = "PATENTSVIEW"
    BASE_URL = "https://api.patentsview.org"
    CACHE_TTL_HOURS = 48
    
    def __init__(self):
        super().__init__(
            rate_limit_calls=10,
            rate_limit_period=1.0,
        )
    
    async def fetch_patent_by_number(
        self,
        patent_number: str,
        country_code: str = "US",
        kind_code: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """Получение данных патента из PatentsView."""
        request_id = self._generate_request_id()
        start_time = time.time()
        
        try:
            endpoint = "/v1/patents"
            clean_number = patent_number.replace(",", "").replace(" ", "").replace("-", "")
            
            # PatentsView использует POST для запросов
            json_body = {
                "included_fields": "all",
                "criteria": {
                    "patent_number": clean_number
                }
            }
            
            response = await self.post(endpoint, json_body=json_body)
            latency_ms = (time.time() - start_time) * 1000
            response.raise_for_status()
            
            data = response.json()
            patents = data.get("patents", [])
            patent_data = patents[0] if patents else {}
            
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=bool(patent_data),
                status_code=response.status_code,
                latency_ms=latency_ms,
                data=patent_data,
                request_id=request_id,
            )
            
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                latency_ms=latency_ms,
                error_message=str(e),
                request_id=request_id,
            )
    
    async def search_patents(
        self,
        query: str,
        page: int = 1,
        per_page: int = 20,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """Поиск патентов через PatentsView."""
        request_id = self._generate_request_id()
        start_time = time.time()
        
        try:
            endpoint = "/v1/patents/search"
            
            criteria = {"_fulltext": query}
            if date_from:
                criteria["file_date"] = {"_gte": date_from}
            if date_to:
                criteria["file_date"] = criteria.get("file_date", {})
                if isinstance(criteria["file_date"], dict):
                    criteria["file_date"]["_lte"] = date_to
            
            json_body = {
                "included_fields": "all",
                "criteria": criteria,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                }
            }
            
            response = await self.post(endpoint, json_body=json_body)
            latency_ms = (time.time() - start_time) * 1000
            response.raise_for_status()
            
            data = response.json()
            
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=True,
                status_code=response.status_code,
                latency_ms=latency_ms,
                data=data,
                request_id=request_id,
            )
            
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                latency_ms=latency_ms,
                error_message=str(e),
                request_id=request_id,
            )
    
    def _map_to_normalized_record(self, data: Dict[str, Any]) -> Optional[NormalizedPatentRecord]:
        """Маппинг ответа PatentsView в нормализованную запись."""
        if not data:
            return None
        
        return NormalizedPatentRecord(
            source="PATENTSVIEW",
            source_id=data.get("patent_number", ""),
            country_code="US",
            kind_code=data.get("kind"),
            title=data.get("title", "Unknown"),
            abstract=data.get("abstract"),
            filing_date=data.get("file_date"),
            publication_date=data.get("publication_date"),
            grant_date=data.get("grant_date"),
            status=self._normalize_status(data.get("status")),
            assignees=self._parse_assignees(data.get("assignees", [])),
            inventors=self._parse_inventors(data.get("inventors", [])),
            cpc_classes=data.get("cpc"),
            uspc_classes=data.get("uspc"),
            citations_count=data.get("citations_count"),
            geo_data=self._parse_geo_data(data),
            raw_data=data,
        )
    
    @staticmethod
    def _parse_assignees(raw_assignees: Any) -> List[Dict[str, Optional[str]]]:
        if not raw_assignees:
            return []
        return [
            {"name": a.get("name"), "type": a.get("type"), "country": a.get("country")}
            for a in (raw_assignees if isinstance(raw_assignees, list) else [raw_assignees])
        ]
    
    @staticmethod
    def _parse_inventors(raw_inventors: Any) -> List[Dict[str, Optional[str]]]:
        if not raw_inventors:
            return []
        return [
            {"name": i.get("name"), "country": i.get("country")}
            for i in (raw_inventors if isinstance(raw_inventors, list) else [raw_inventors])
        ]
    
    @staticmethod
    def _parse_geo_data(data: Dict[str, Any]) -> Dict[str, Optional[List[str]]]:
        return {
            "assignee_countries": list(set(a.get("country") for a in data.get("assignees", []) if a.get("country"))) or None,
            "inventor_countries": list(set(i.get("country") for i in data.get("inventors", []) if i.get("country"))) or None,
        }


# =============================================================================
# EPO OPS API Client
# =============================================================================

class EpoOpsClient(BasePatentClient):
    """
    Клиент для EPO Open Patent Services (OPS) API.
    
    API documentation: https://worldwide.espacenet.com/ops
    Требуется OAuth2 Consumer Key/Secret.
    Лимит: 4GB/месяц бесплатно.
    """
    
    SOURCE_NAME = "EPO_OPS"
    BASE_URL = "https://ops.epo.org/rest-services"
    CACHE_TTL_HOURS = 48
    
    def __init__(
        self,
        consumer_key: Optional[str] = None,
        consumer_secret: Optional[str] = None,
    ):
        super().__init__(
            consumer_key=consumer_key or getattr(settings, "EPO_OPS_CONSUMER_KEY", None),
            consumer_secret=consumer_secret or getattr(settings, "EPO_OPS_CONSUMER_SECRET", None),
            rate_limit_calls=5,
            rate_limit_period=1.0,
        )
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
    
    async def _get_auth_headers(self) -> Dict[str, str]:
        """Получение OAuth2 токена и заголовков."""
        await self._ensure_valid_token()
        
        headers = await super()._get_auth_headers()
        headers["Accept"] = "application/xml"  # EPO OPS использует XML
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
        return headers
    
    async def _ensure_valid_token(self):
        """Получение/обновление OAuth2 токена."""
        if self._access_token and self._token_expires_at:
            if datetime.now(timezone.utc) < self._token_expires_at:
                return  # Токен действителен
        
        # Запрос нового токена
        # TODO: Реализовать OAuth2 client credentials flow
        # token_url = "https://ops.epo.org/auth/oauth/token"
        # response = await httpx.AsyncClient().post(
        #     token_url,
        #     data={
        #         "grant_type": "client_credentials",
        #         "client_id": self.consumer_key,
        #         "client_secret": self.consumer_secret,
        #     }
        # )
        # token_data = response.json()
        # self._access_token = token_data["access_token"]
        # self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])
        pass
    
    async def fetch_patent_by_number(
        self,
        patent_number: str,
        country_code: str = "EP",
        kind_code: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """
        Получение данных патента EPO по номеру.
        
        endpoint: /published-data/publication/{publn_srce}/{publn_nr}/{kind}
        """
        request_id = self._generate_request_id()
        start_time = time.time()
        
        try:
            # Формирование номера публикации EPO
            # EP номер формата: EP1234567A1
            clean_number = patent_number.replace(" ", "").replace("-", "").upper()
            if not clean_number.startswith("EP"):
                clean_number = f"EP{clean_number}"
            
            # Извлечение kind code
            kind = kind_code or ""
            for suffix in ["A1", "A2", "B1", "B2", "A", "B"]:
                if clean_number.endswith(suffix):
                    kind = suffix
                    clean_number = clean_number[:-len(suffix)]
                    break
            
            endpoint = f"/published-data/publication/epo/{clean_number}/{kind}"
            
            response = await self.get(endpoint)
            latency_ms = (time.time() - start_time) * 1000
            
            if response.status_code == 404:
                return ExternalApiCallResult(
                    source=self.SOURCE_NAME,
                    success=False,
                    status_code=404,
                    latency_ms=latency_ms,
                    error_message="Patent not found",
                    request_id=request_id,
                )
            
            response.raise_for_status()
            
            # TODO: Парсинг XML ответа EPO OPS
            # xml_data = response.text
            # parsed = self._parse_epo_xml(xml_data)
            
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=True,
                status_code=response.status_code,
                latency_ms=latency_ms,
                data={"xml": response.text},  # TODO: Заменить на распарсенные данные
                request_id=request_id,
            )
            
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                latency_ms=latency_ms,
                error_message=str(e),
                request_id=request_id,
            )
    
    async def search_patents(
        self,
        query: str,
        page: int = 1,
        per_page: int = 20,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """Поиск патентов через EPO OPS."""
        # TODO: Реализовать поиск через EPO OPS
        # EPO OPS не имеет прямого search endpoint, нужно использовать
        # worldwide.espacenet.com или другие endpoints
        return ExternalApiCallResult(
            source=self.SOURCE_NAME,
            success=False,
            error_message="Search not implemented for EPO OPS",
        )
    
    def _map_to_normalized_record(self, data: Dict[str, Any]) -> Optional[NormalizedPatentRecord]:
        """Маппинг ответа EPO OPS в нормализованную запись."""
        if not data:
            return None
        
        # TODO: Детальный парсинг XML EPO OPS
        xml_data = data.get("xml", "")
        
        return NormalizedPatentRecord(
            source="EPO_OPS",
            source_id=data.get("publicationNumber", ""),
            country_code="EP",
            kind_code=data.get("kind"),
            title=data.get("title", "Unknown"),
            abstract=data.get("abstract"),
            filing_date=data.get("filingDate"),
            publication_date=data.get("publicationDate"),
            status="unknown",  # TODO: Извлечь статус из XML
            family_ids=data.get("familyIds"),
            raw_data=data,
        )
    
    @staticmethod
    def _parse_epo_xml(xml_string: str) -> Dict[str, Any]:
        """
        Парсинг XML ответа EPO OPS.
        
        TODO: Реализовать полноценный парсинг с использованием xml.etree.ElementTree
        или lxml для извлечения:
        - publication number
        - title (en)
        - abstract (en)
        - filing date
        - publication date
        - applicants
        - inventors
        - IPC/CPC classes
        - family references
        """
        # Placeholder implementation
        return {"xml": xml_string}


# =============================================================================
# WIPO PATENTSCOPE Client
# =============================================================================

class WipoPatentscopeClient(BasePatentClient):
    """
    Клиент для WIPO PATENTSCOPE API.
    
    API documentation: https://patentscope.wipo.int/
    Поддерживает PCT заявки и международные публикации.
    """
    
    SOURCE_NAME = "WIPO_PCT"
    BASE_URL = "https://patentscope.wipo.int/api"
    CACHE_TTL_HOURS = 48
    
    def __init__(self, api_key: Optional[str] = None):
        super().__init__(
            api_key=api_key or getattr(settings, "WIPO_API_KEY", None),
            rate_limit_calls=10,
            rate_limit_period=1.0,
        )
    
    async def _get_auth_headers(self) -> Dict[str, str]:
        headers = await super()._get_auth_headers()
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers
    
    async def fetch_patent_by_number(
        self,
        patent_number: str,
        country_code: str = "WO",
        kind_code: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """Получение PCT заявки по номеру."""
        request_id = self._generate_request_id()
        start_time = time.time()
        
        try:
            # WIPO номер формата: WO2020/123456
            clean_number = patent_number.replace(" ", "").replace("-", "").upper()
            
            endpoint = f"/v2/publications/{clean_number}"
            
            response = await self.get(endpoint)
            latency_ms = (time.time() - start_time) * 1000
            
            if response.status_code == 404:
                return ExternalApiCallResult(
                    source=self.SOURCE_NAME,
                    success=False,
                    status_code=404,
                    latency_ms=latency_ms,
                    error_message="Publication not found",
                    request_id=request_id,
                )
            
            response.raise_for_status()
            data = response.json()
            
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=True,
                status_code=response.status_code,
                latency_ms=latency_ms,
                data=data,
                request_id=request_id,
            )
            
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                latency_ms=latency_ms,
                error_message=str(e),
                request_id=request_id,
            )
    
    async def search_patents(
        self,
        query: str,
        page: int = 1,
        per_page: int = 20,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> ExternalApiCallResult:
        """Поиск PCT заявок через WIPO PATENTSCOPE."""
        request_id = self._generate_request_id()
        start_time = time.time()
        
        try:
            endpoint = "/v2/search"
            params = {
                "q": query,
                "page": page,
                "size": per_page,
            }
            
            if date_from:
                params["filingDateFrom"] = date_from
            if date_to:
                params["filingDateTo"] = date_to
            
            response = await self.get(endpoint, params=params)
            latency_ms = (time.time() - start_time) * 1000
            response.raise_for_status()
            
            data = response.json()
            
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=True,
                status_code=response.status_code,
                latency_ms=latency_ms,
                data=data,
                request_id=request_id,
            )
            
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return ExternalApiCallResult(
                source=self.SOURCE_NAME,
                success=False,
                latency_ms=latency_ms,
                error_message=str(e),
                request_id=request_id,
            )
    
    def _map_to_normalized_record(self, data: Dict[str, Any]) -> Optional[NormalizedPatentRecord]:
        """Маппинг ответа WIPO в нормализованную запись."""
        if not data:
            return None
        
        return NormalizedPatentRecord(
            source="WIPO_PCT",
            source_id=data.get("publicationNumber", ""),
            country_code="WO",
            kind_code=data.get("kind"),
            title=data.get("title", "Unknown"),
            abstract=data.get("abstract"),
            filing_date=data.get("filingDate"),
            publication_date=data.get("publicationDate"),
            status="pending",  # PCT заявки обычно pending
            assignees=self._parse_applicants(data.get("applicants", [])),
            inventors=self._parse_inventors(data.get("inventors", [])),
            ipc_classes=data.get("ipcClasses"),
            family_ids=data.get("familyIds"),
            priority_numbers=data.get("priorityNumbers"),
            raw_data=data,
        )
    
    @staticmethod
    def _parse_applicants(raw_applicants: Any) -> List[Dict[str, Optional[str]]]:
        if not raw_applicants:
            return []
        return [
            {"name": a.get("name"), "country": a.get("country"), "type": "company"}
            for a in (raw_applicants if isinstance(raw_applicants, list) else [raw_applicants])
        ]
    
    @staticmethod
    def _parse_inventors(raw_inventors: Any) -> List[Dict[str, Optional[str]]]:
        if not raw_inventors:
            return []
        return [
            {"name": i.get("name"), "country": i.get("country")}
            for i in (raw_inventors if isinstance(raw_inventors, list) else [raw_inventors])
        ]


# =============================================================================
# Фабрика клиентов
# =============================================================================

def create_patent_client(source: str) -> BasePatentClient:
    """Фабричная функция для создания клиента по источнику."""
    clients = {
        "USPTO": UsptoPatentClient,
        "PATENTSVIEW": PatentsViewClient,
        "EPO_OPS": EpoOpsClient,
        "WIPO_PCT": WipoPatentscopeClient,
    }
    
    client_class = clients.get(source.upper())
    if not client_class:
        raise ValueError(f"Unknown patent source: {source}")
    
    return client_class()
