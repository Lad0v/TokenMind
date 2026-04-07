"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, FileText, MessageSquare, Shield } from "lucide-react"

import { Header } from "@/components/user/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ApiError, claimsApi, toBackendAssetUrl, type IpClaim } from "@/lib/api"
import { useRoleGuard } from "@/lib/use-role-guard"

export default function IssuerClaimDetailPage() {
  const params = useParams<{ id: string }>()
  const { status, isAuthorized } = useRoleGuard(["issuer", "user", "admin"])
  const [claim, setClaim] = useState<IpClaim | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthorized || !params?.id) {
      return
    }

    let isCancelled = false

    const loadClaim = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await claimsApi.getById(params.id)
        if (!isCancelled) {
          setClaim(response)
        }
      } catch (caughtError) {
        if (isCancelled) {
          return
        }

        if (caughtError instanceof ApiError) {
          setError(caughtError.message)
        } else if (caughtError instanceof Error) {
          setError(caughtError.message)
        } else {
          setError("Не удалось загрузить карточку заявки.")
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadClaim()

    return () => {
      isCancelled = true
    }
  }, [isAuthorized, params?.id])

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading claim detail...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/issuer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к списку заявок
          </Link>

          {isLoading ? (
            <div className="rounded-xl border border-border bg-card/50 p-8 text-sm text-muted-foreground">
              Загрузка карточки...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-sm text-destructive">
              {error}
            </div>
          ) : !claim ? (
            <div className="rounded-xl border border-border bg-card/50 p-8 text-sm text-muted-foreground">
              Заявка не найдена.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card/50 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">{claim.patent_title || claim.patent_number}</h1>
                    <p className="text-muted-foreground mt-2">{claim.claimed_owner_name}</p>
                  </div>
                  <Badge variant="outline" className="w-fit border-primary/30 bg-primary/10 text-primary">
                    {claim.status}
                  </Badge>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Patent Number</p>
                    <p className="text-sm text-foreground mt-1">{claim.patent_number}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Jurisdiction</p>
                    <p className="text-sm text-foreground mt-1">{claim.jurisdiction || "N/A"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Issuer</p>
                    <p className="text-sm text-foreground mt-1">{claim.issuer_name || claim.issuer_email || "N/A"}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/50 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Created At</p>
                    <p className="text-sm text-foreground mt-1">{new Date(claim.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {claim.description && (
                  <div className="mt-6 rounded-lg border border-border bg-background/50 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Описание</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{claim.description}</p>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Precheck и внешние данные</h2>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-border bg-background/70 p-4 text-xs text-muted-foreground">
                  {JSON.stringify(
                    {
                      prechecked: claim.prechecked,
                      precheck_status: claim.precheck_status,
                      source_id: claim.source_id,
                      patent_metadata: claim.patent_metadata,
                      external_metadata: claim.external_metadata,
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>

              <section className="rounded-xl border border-border bg-card/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Документы</h2>
                </div>
                {claim.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Документы ещё не загружены.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {claim.documents.map((document) => (
                      <div key={document.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-4">
                        <div>
                          <p className="text-sm text-foreground">{document.doc_type || "supporting_document"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(document.uploaded_at).toLocaleString()}</p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <a href={toBackendAssetUrl(document.file_url) ?? "#"} target="_blank" rel="noreferrer">
                            Открыть
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">История review</h2>
                </div>
                {claim.reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Review history пока отсутствует.</p>
                ) : (
                  <div className="space-y-3">
                    {claim.reviews.map((review) => (
                      <div key={review.id} className="rounded-lg border border-border bg-background/50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{review.decision}</p>
                          <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleString()}</p>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Reviewer: {review.reviewer_email || "system"}
                        </p>
                        {review.notes && <p className="mt-2 text-sm text-foreground">{review.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
