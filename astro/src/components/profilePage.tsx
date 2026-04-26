import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { PaperDoc, ProjectDoc, UserDoc } from "@/lib/entities";
import { createPaper } from "@/lib/api/papers";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import EmptyPaperNotes from "./emptyPagesComp";
import PaperCardComponent from "./paperCardComponent";
import ProjectCard from "./project/ProjectCard";

type ProfilePageProps = {
    user: UserDoc;
    papers: PaperDoc[];
    projects: ProjectDoc[];
    currentUserId: string | null;
};

export default function ProfilePage({ user, papers, projects, currentUserId }: ProfilePageProps) {
    const tabs = ["Papers", "Libraries", "Contact"];
    const [currentTab, setCurrentTab] = useState("Papers");
    const [creatingPaper, setCreatingPaper] = useState(false);
    const isOwnProfile = currentUserId === user.userId;

    async function handleCreatePaper() {
        setCreatingPaper(true);

        try {
            const createPromise = createPaper({});
            toast.promise(createPromise, {
                loading: "Creating paper...",
                success: "Paper created.",
                error: "Failed to create paper.",
            });
            const paper = await createPromise;
            window.location.href = `/write/${paper.paperId}`;
        } catch {
            // No-op: toast.promise already displays the failure state.
        } finally {
            setCreatingPaper(false);
        }
    }

    return (
        <>
            <div className="flex gap-5 justify-center">
                {tabs.map((tab) => (
                    <button key={tab}
                        className="hover:bg-muted transition-all duration-400 px-3 py-1 rounded-sm relative"
                        onClick={() => {
                            setCurrentTab(tab);
                        }}
                    >
                        {tab}
                        <div
                            className={`absolute bottom-[-6px] left-[50%] translate-x-[-50%] h-[3px] rounded-[10px] bg-primary z-2 transition-all duration-400 ${currentTab == tab ? "opacity-[1]  w-[70%]" : "opacity-[0] w-[0%]"
                                }`}
                        />
                    </button>
                ))}
            </div>

            {/* Papers Tab */}
            {currentTab === "Papers" && (
                <div className="space-y-10">
                    {papers.length === 0 && !isOwnProfile ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No papers published yet</p>
                        </div>
                    ) : papers.length === 0 && isOwnProfile ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <EmptyPaperNotes height={180} width={180} />
                            <Label className="mt-4">No papers created</Label>
                            <Button loading={creatingPaper} onClick={handleCreatePaper} className="mt-5">
                                <PlusIcon /> Create Paper
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="flex justify-center">
                                {isOwnProfile && (
                                    <Button loading={creatingPaper} onClick={handleCreatePaper} className="w-fit mt-10" variant="secondary">
                                        <PlusIcon /> Create Paper
                                    </Button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                {papers.map((paper) => (
                                    <PaperCardComponent
                                        key={paper.paperId}
                                        handle={user.username}
                                        paperData={paper}
                                        showStatus={false}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Projects Tab */}
            {currentTab === "Libraries" && (
                <div className="space-y-10">
                    <div className="flex justify-center">
                        {isOwnProfile && (
                            <a href="/dashboard" className="w-fit mt-10">
                                <Button variant="secondary">Dashboard</Button>
                            </a>
                        )}
                    </div>
                    {projects.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No projects published yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-5">
                            {projects.map((project) => (
                                <ProjectCard
                                    key={project.projectId}
                                    project={project}
                                    href={`/${user.username}/p/${project.slug}`}
                                    showLockIcon={false}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Contact Tab */}
            {currentTab === "Contact" && (
                <div className="mt-10">
                    {/* Leave blank as requested */}
                </div>
            )}
        </>
    );
}
