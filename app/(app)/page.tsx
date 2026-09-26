import { redirect } from "next/navigation";

/** A casa do app agora é o diário: a conversa solta saiu. */
export default function Raiz() {
  redirect("/diario");
}
