import { Alert } from '../../../components/ui/Alert'

type AuthErrorProps = {
  error?: Error | null
}

export function AuthError({ error }: AuthErrorProps) {
  if (!error) return null

  return <Alert variant="error">{error.message}</Alert>
}
