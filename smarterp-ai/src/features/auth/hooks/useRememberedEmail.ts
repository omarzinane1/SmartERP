import { useState } from 'react'

const rememberedEmailKey = 'smarterp.remembered-email'

function readRememberedEmail() {
  try {
    return localStorage.getItem(rememberedEmailKey) ?? ''
  } catch {
    return ''
  }
}

export function useRememberedEmail() {
  const [initialEmail] = useState(readRememberedEmail)
  const [rememberEmail, setRememberEmail] = useState(Boolean(initialEmail))

  function toggleRememberEmail(remember: boolean) {
    setRememberEmail(remember)

    if (!remember) {
      try {
        localStorage.removeItem(rememberedEmailKey)
      } catch {
        // Storage can be unavailable in restricted browser sessions.
      }
    }
  }

  function saveRememberedEmail(email: string) {
    try {
      if (rememberEmail) {
        localStorage.setItem(rememberedEmailKey, email)
      } else {
        localStorage.removeItem(rememberedEmailKey)
      }
    } catch {
      // Remembering an email is optional and must never block authentication.
    }
  }

  return {
    initialEmail,
    rememberEmail,
    toggleRememberEmail,
    saveRememberedEmail,
  }
}
