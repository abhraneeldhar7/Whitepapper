import WriteEditor from "@/components/write/WriteEditor";
import type { PaperDoc, UserDoc } from "@/lib/types";

type WriteEditorRootProps = {
  initialPaper: PaperDoc;
  initialUser?: UserDoc | null;
  integrationBaseUrl?: string;
};

export default function WriteEditorRoot({ initialPaper, initialUser, integrationBaseUrl }: WriteEditorRootProps) {
  return <WriteEditor initialPaper={initialPaper} initialUser={initialUser} integrationBaseUrl={integrationBaseUrl} />;
}
