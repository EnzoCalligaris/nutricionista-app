export { cn } from "cn"

/** Iniciais para avatar a partir de um nome completo — ignora tokens sem letra (ex.: "(dev)"). */
export function initials(fullName: string): string {
  const letterParts = fullName
    .trim()
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
  const first = letterParts[0]?.match(/\p{L}/u)?.[0] ?? ""
  const last =
    letterParts.length > 1 ? (letterParts[letterParts.length - 1]?.match(/\p{L}/u)?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}
