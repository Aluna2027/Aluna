'use client';

import { type FormEvent, type ReactNode } from 'react';

export function ArchiveOrganizationConfirmation({ children }: { children: ReactNode }) {
  function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.hasAttribute('data-archive-organization')) return;

    const name = target.dataset.organizationName || 'this organization';
    const confirmed = window.confirm(
      `Are you sure you want to archive "${name}"?\n\nThe organization will be hidden from the directory. Only an Aluna Super Admin can restore it.`
    );

    if (!confirmed) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return <div onSubmitCapture={handleSubmitCapture}>{children}</div>;
}
