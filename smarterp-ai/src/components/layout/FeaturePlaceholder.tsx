import { Link } from 'react-router-dom'

export function FeaturePlaceholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-3 text-slate-600">Connexion établie. Cette page sera développée lors d’une prochaine étape.</p>
      <Link to="/login" className="mt-6 inline-block rounded text-sm font-medium text-blue-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Retour à la connexion</Link>
    </main>
  )
}
