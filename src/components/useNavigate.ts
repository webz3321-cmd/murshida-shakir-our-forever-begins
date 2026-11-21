/** Tiny client-side navigation helper (no router dependency). */
export function useNavigate() {
  return (path: string) => {
    window.location.href = path
  }
}
