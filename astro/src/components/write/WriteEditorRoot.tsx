import WriteEditor from "@/components/write/WriteEditor";
import type { PaperDoc, UserDoc } from "@/lib/types";

type WriteEditorRootProps = {
  initialPaper: PaperDoc;
  initialUser?: UserDoc | null;
};

export default function WriteEditorRoot({ initialPaper, initialUser }: WriteEditorRootProps) {
  return <WriteEditor initialPaper={initialPaper} initialUser={initialUser} />;
}
