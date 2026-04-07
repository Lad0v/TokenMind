from functools import lru_cache

from app.blockchain.client import SolanaBlockchainClient
from app.core.config import settings


@lru_cache
def get_blockchain_client() -> SolanaBlockchainClient:
    return SolanaBlockchainClient(settings)
