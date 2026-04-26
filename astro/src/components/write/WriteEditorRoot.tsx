import WriteEditor from "@/components/write/WriteEditor";
import type { PaperDoc, UserDoc } from "@/lib/entities";

type WriteEditorRootProps = {
  initialPaper: PaperDoc;
  initialUser?: UserDoc | null;
  integrationBaseUrl?: string;
  isMobileUA: boolean;
};

export default function WriteEditorRoot({ initialPaper, initialUser, integrationBaseUrl, isMobileUA }: WriteEditorRootProps) {
  return (
    <WriteEditor
      initialPaper={initialPaper}
      initialUser={initialUser}
      integrationBaseUrl={integrationBaseUrl}
      isMobileUA={isMobileUA}
    />
  );
}

