'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CampaignWizard } from '@/features/campaigns/components/campaign-wizard';

export default function NewCampaignPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-zinc-200 px-8 py-5 dark:border-white/10">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
          <ArrowLeft className="size-4" /> Campanhas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nova campanha</h1>
      </div>
      <CampaignWizard />
    </div>
  );
}
