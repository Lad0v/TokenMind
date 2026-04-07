"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock, Search, Shield, TrendingUp, Wallet } from "lucide-react";

import { Header } from "@/components/user/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient, MarketplaceListing } from "@/lib/api-client";
import { lamportsToSol } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export default function MarketplacePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.listMarketplace();
        setListings(response.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить маркетплейс");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredListings = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) {
      return listings;
    }
    return listings.filter((item) =>
      [item.tokenization.claim.patent_title, item.tokenization.claim.patent_number, item.issuer_name]
        .some((value) => (value ?? "").toLowerCase().includes(term)),
    );
  }, [listings, searchQuery]);

  const totalAvailable = filteredListings.reduce(
    (sum, item) => sum + (item.listing.remaining_supply ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Маркетплейс</h1>
          <p className="text-muted-foreground">
            Активные primary-sale listings, синхронизированные с on-chain `ListingState`.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Поиск по патенту, названию или issuer..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10 h-12 bg-card border-border"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Shield, label: "Активных листингов", value: String(filteredListings.length) },
            { icon: Wallet, label: "Доступных shares", value: totalAvailable.toLocaleString("ru-RU") },
            {
              icon: TrendingUp,
              label: "Средняя цена",
              value:
                filteredListings.length > 0
                  ? `${lamportsToSol(
                      Math.round(
                        filteredListings.reduce((sum, item) => sum + item.listing.price_per_share_lamports, 0) /
                          filteredListings.length,
                      ),
                    )} SOL`
                  : "—",
            },
            { icon: Clock, label: "Investor access", value: user?.role === "investor" ? "Enabled" : "Login" },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-lg border border-border bg-card/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card/50 p-10 text-center text-muted-foreground">
            Загрузка активных on-chain listings...
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-border bg-card/50">
            <h3 className="text-lg font-semibold text-foreground mb-2">Активных листингов нет</h3>
            <p className="text-muted-foreground">Когда issuers завершат on-chain lifecycle, активы появятся здесь.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((item) => (
              <Link
                key={item.listing.id}
                href={`/marketplace/${item.listing.id}`}
                className="group p-6 rounded-xl border border-border bg-card/50 hover:border-primary/50 hover:bg-card transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                    {item.listing.status}
                  </Badge>
                  <Badge variant="secondary">Primary sale</Badge>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1">{item.tokenization.claim.patent_number}</p>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {item.tokenization.claim.patent_title ?? item.tokenization.claim.patent_number}
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{item.issuer_name ?? "Issuer"}</p>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Цена</p>
                    <p className="text-lg font-semibold text-primary">
                      {lamportsToSol(item.listing.price_per_share_lamports)} SOL
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Доступно</p>
                    <p className="text-sm text-foreground">
                      {item.listing.remaining_supply ?? "—"} / {item.tokenization.sale_supply}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!user && (
          <div className="mt-12 p-8 rounded-xl border border-primary/30 bg-card/50 text-center">
            <h3 className="text-xl font-semibold text-foreground mb-2">Хотите участвовать в primary sale?</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Зарегистрируйте investor-account, привяжите кошелёк и проходите дальше через backend-backed flow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/auth/register">Зарегистрироваться</Link>
              </Button>
              <Button variant="outline" asChild className="border-border hover:border-primary/50">
                <Link href="/auth/login">Уже есть кошелёк</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
