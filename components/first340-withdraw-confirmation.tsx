'use client';

export function First340WithdrawConfirmation({ action }: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return <form action={action} onSubmit={(event) => {
    if (!window.confirm('Withdraw this application? Its answers and audit history will be retained.')) event.preventDefault();
  }}>
    <button type="submit" className="text-sm text-red-300">Withdraw application</button>
  </form>;
}
