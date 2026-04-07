'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DocumentUploader } from '@/components/ui/DocumentUploader';
import { Input } from '@/components/ui/Input';

export default function NewIssuerClaimPage() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
          Issuer · New Claim
        </p>
        <h1 className="text-4xl font-elegant">Создание patent claim</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Заполните карточку актива, прикрепите подтверждающие документы и запустите pre-check.
        </p>
      </section>

      <div className="grid xl:grid-cols-[1fr_0.8fr] gap-6">
        <Card>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <Input label="Название актива" placeholder="NanoSeal Patent" />
            <Input label="Номер патента" placeholder="US-2026-AX-1128" />
            <Input label="Юрисдикция" placeholder="US / EU / KZ" />

            <div className="flex flex-col space-y-1.5">
              <label className="text-[13px] font-medium tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>
                Описание claim
              </label>
              <textarea
                className="min-h-36 rounded-xl px-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'rgba(13, 34, 25, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Опишите интеллектуальный актив, владельца прав и основание притязаний..."
              />
            </div>

            <div className="pt-2 flex gap-3 flex-wrap">
              <Button type="submit">Запустить pre-check</Button>
              <Button variant="outline" type="button">Сохранить черновик</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-2xl font-elegant mb-4">Документы</h2>
          <DocumentUploader onFilesSelected={setFiles} />
          <div className="mt-4 space-y-2">
            {files.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Файлы ещё не выбраны.</p>
            ) : (
              files.map((file) => (
                <div key={file.name} className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  {file.name}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
