import { FormPerfil } from "@/components/FormPerfil";
import { BlocoConta } from "@/components/BlocoConta";
import { getPerfilEAlvos } from "@/lib/data";
import { usuarioAtual } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PaginaPerfil() {
  const [{ perfil }, user] = await Promise.all([getPerfilEAlvos(), usuarioAtual()]);

  return (
    <div className="space-y-4">
      <h1 className="display text-lg font-semibold">Perfil</h1>

      <FormPerfil perfil={perfil} />

      <BlocoConta
        email={user?.email ?? ""}
        token={perfil.ingest_token}
        limite={perfil.ai_diario_limite}
      />
    </div>
  );
}
