"use client";

import { useState, useMemo, useEffect } from "react";
import {
  HelpCircle,
  FlaskConical,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTestModeStore } from "@/lib/stores/testModeStore";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SavedQuestion, SavedPoison } from "@/lib/types";

type Tab = "questions" | "poisons";

const TIER_COLORS: Record<string, string> = {
  easy: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  hard: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  batch: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  cloud: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

const TIER_LABELS: Record<string, string> = {
  easy: "Easy (Local)",
  hard: "Hard",
  batch: "Batch",
  cloud: "Cloud",
};

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("questions");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit states
  const [editingQuestion, setEditingQuestion] = useState<SavedQuestion | null>(null);
  const [editingPoison, setEditingPoison] = useState<SavedPoison | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Store data
  const questions = useTestModeStore((s) => s.questions);
  const poisons = useTestModeStore((s) => s.poisons);
  const addQuestion = useTestModeStore((s) => s.addQuestion);
  const updateQuestion = useTestModeStore((s) => s.updateQuestion);
  const removeQuestion = useTestModeStore((s) => s.removeQuestion);
  const addPoison = useTestModeStore((s) => s.addPoison);
  const updatePoison = useTestModeStore((s) => s.updatePoison);
  const removePoison = useTestModeStore((s) => s.removePoison);

  // Hydrate store on mount to seed defaults
  useEffect(() => {
    useTestModeStore.getState().hydrate();
  }, []);

  // Filter by search
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const query = searchQuery.toLowerCase();
    return questions.filter(q =>
      q.question.toLowerCase().includes(query) ||
      (q.tier && q.tier.toLowerCase().includes(query))
    );
  }, [questions, searchQuery]);

  const filteredPoisons = useMemo(() => {
    if (!searchQuery.trim()) return poisons;
    const query = searchQuery.toLowerCase();
    return poisons.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.content.toLowerCase().includes(query) ||
      p.markers.some(m => m.toLowerCase().includes(query))
    );
  }, [poisons, searchQuery]);

  // Group questions by tier
  const questionsByTier = useMemo(() => {
    const groups: Record<string, SavedQuestion[]> = {
      easy: [],
      hard: [],
      batch: [],
      cloud: [],
    };
    filteredQuestions.forEach(q => {
      const tier = q.tier || 'batch';
      if (groups[tier]) {
        groups[tier].push(q);
      }
    });
    return groups;
  }, [filteredQuestions]);

  // Group poisons by tier (extracted from name prefix)
  const poisonsByTier = useMemo(() => {
    const groups: Record<string, SavedPoison[]> = {
      easy: [],
      hard: [],
      batch: [],
      cloud: [],
    };
    filteredPoisons.forEach(p => {
      const tierMatch = p.name.match(/^\[(Easy|Hard|Batch|Cloud)\]/i);
      const tier = tierMatch ? tierMatch[1].toLowerCase() : 'batch';
      if (groups[tier]) {
        groups[tier].push(p);
      }
    });
    return groups;
  }, [filteredPoisons]);

  // Handle add new
  const handleAddNew = () => {
    setIsAddingNew(true);
    if (activeTab === "questions") {
      setEditingQuestion({
        id: `q-${Date.now()}`,
        question: "",
        tier: "batch",
        poisonId: "",
      });
    } else {
      setEditingPoison({
        id: `p-${Date.now()}`,
        name: "",
        content: "",
        markers: [],
      });
    }
  };

  // Handle save
  const handleSaveQuestion = () => {
    if (!editingQuestion) return;
    if (isAddingNew) {
      addQuestion(editingQuestion);
    } else {
      updateQuestion(editingQuestion.id, editingQuestion);
    }
    setEditingQuestion(null);
    setIsAddingNew(false);
  };

  const handleSavePoison = () => {
    if (!editingPoison) return;
    if (isAddingNew) {
      addPoison(editingPoison);
    } else {
      updatePoison(editingPoison.id, editingPoison);
    }
    setEditingPoison(null);
    setIsAddingNew(false);
  };

  // Handle delete
  const handleDeleteQuestion = (id: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      removeQuestion(id);
    }
  };

  const handleDeletePoison = (id: string) => {
    if (confirm("Are you sure you want to delete this poison pill?")) {
      removePoison(id);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingQuestion(null);
    setEditingPoison(null);
    setIsAddingNew(false);
  };

  const tabs = [
    { id: "questions" as Tab, label: "Questions", icon: HelpCircle, count: questions.length },
    { id: "poisons" as Tab, label: "Poison Pills", icon: FlaskConical, count: poisons.length },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
      {/* Header - Centered */}
      <div className="border-b border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 px-4 py-3">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Test Library</h1>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Questions &amp; Poison Pills</span>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="border-b border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-4 py-2">
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("questions")}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                activeTab === "questions"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
              )}
            >
              Questions ({questions.length})
            </button>
            <button
              onClick={() => setActiveTab("poisons")}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                activeTab === "poisons"
                  ? "bg-red-600 text-white"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
              )}
            >
              Poison Pills ({poisons.length})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2 py-1.5 w-40 rounded text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <Button
            onClick={handleAddNew}
            size="sm"
            className="px-2 py-1.5 h-auto text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Edit/Add Form Modal */}
        {(editingQuestion || editingPoison) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-700 px-5 py-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                  {isAddingNew ? "Add New" : "Edit"} {editingQuestion ? "Question" : "Poison Pill"}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-5 space-y-4">
                {editingQuestion ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Question</label>
                      <textarea
                        value={editingQuestion.question}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                        className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                        rows={3}
                        placeholder="Enter the test question..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Difficulty Tier</label>
                      <select
                        value={editingQuestion.tier || "batch"}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, tier: e.target.value as SavedQuestion["tier"] })}
                        className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="easy">Easy (Local LLMs)</option>
                        <option value="hard">Hard</option>
                        <option value="batch">Batch</option>
                        <option value="cloud">Cloud (Advanced)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Linked Poison (optional)</label>
                      <select
                        value={editingQuestion.poisonId || ""}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, poisonId: e.target.value })}
                        className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">None</option>
                        {poisons.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Expected Answer (optional)</label>
                      <input
                        type="text"
                        value={editingQuestion.expectedAnswer || ""}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, expectedAnswer: e.target.value })}
                        className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                        placeholder="The correct answer..."
                      />
                    </div>
                  </>
                ) : editingPoison && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Name</label>
                      <input
                        type="text"
                        value={editingPoison.name}
                        onChange={(e) => setEditingPoison({ ...editingPoison, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                        placeholder="[Tier] Descriptive name..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">False Claim Content</label>
                      <textarea
                        value={editingPoison.content}
                        onChange={(e) => setEditingPoison({ ...editingPoison, content: e.target.value })}
                        className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                        rows={4}
                        placeholder="The false claim to inject..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1.5">Detection Markers (comma-separated)</label>
                      <input
                        type="text"
                        value={editingPoison.markers.join(", ")}
                        onChange={(e) => setEditingPoison({
                          ...editingPoison,
                          markers: e.target.value.split(",").map(m => m.trim()).filter(Boolean)
                        })}
                        className="w-full px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                        placeholder="1920, paris, incorrect date"
                      />
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Keywords to detect if the AI echoes this false claim</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-zinc-700 px-5 py-4">
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={editingQuestion ? handleSaveQuestion : handleSavePoison}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Questions Grid - Tier Column Layout */}
        {activeTab === "questions" && (
          <>
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 dark:text-zinc-500">
                {searchQuery ? "No questions match your search" : "No questions yet. Add your first one!"}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {(['easy', 'hard', 'batch', 'cloud'] as const).map(tier => (
                  <div key={tier} className="flex flex-col">
                    {/* Tier column header */}
                    <div className="sticky top-0 bg-gray-50 dark:bg-zinc-950 pb-2 border-b border-gray-200 dark:border-zinc-800 mb-2">
                      <h3 className={cn(
                        "text-sm font-bold",
                        TIER_COLORS[tier].split(' ')[1]
                      )}>
                        {TIER_LABELS[tier]}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-zinc-500">
                        ({questionsByTier[tier].length} questions)
                      </span>
                    </div>

                    {/* Questions stack vertically */}
                    <div className="space-y-1.5">
                      {questionsByTier[tier].length === 0 ? (
                        <p className="text-[10px] text-gray-400 dark:text-zinc-600 italic">
                          No {tier} questions
                        </p>
                      ) : (
                        questionsByTier[tier].map((q) => {
                          const linkedPoison = poisons.find(p => p.id === q.poisonId);
                          return (
                            <div
                              key={q.id}
                              className="relative p-2 rounded bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors group"
                            >
                              {/* Question text - no tier badge needed */}
                              <p className="text-[10px] text-gray-900 dark:text-zinc-200 font-medium line-clamp-3 leading-tight">{q.question}</p>

                              {/* Linked poison - tiny pill */}
                              {linkedPoison && (
                                <div className="flex items-center gap-0.5 mt-1">
                                  <FlaskConical className="h-2 w-2 text-rose-500 flex-shrink-0" />
                                  <span className="text-[8px] text-rose-500 dark:text-rose-400 truncate">{linkedPoison.name}</span>
                                </div>
                              )}

                              {/* Edit/Delete */}
                              <div className="flex items-center justify-end gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingQuestion(q);
                                    setIsAddingNew(false);
                                  }}
                                  className="p-0.5 rounded text-gray-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-0.5 rounded text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Poisons Grid - Tier Column Layout */}
        {activeTab === "poisons" && (
          <>
            {filteredPoisons.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 dark:text-zinc-500">
                {searchQuery ? "No poison pills match your search" : "No poison pills yet. Add your first one!"}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {(['easy', 'hard', 'batch', 'cloud'] as const).map(tier => (
                  <div key={tier} className="flex flex-col">
                    {/* Tier column header */}
                    <div className="sticky top-0 bg-gray-50 dark:bg-zinc-950 pb-2 border-b border-gray-200 dark:border-zinc-800 mb-2">
                      <h3 className={cn(
                        "text-sm font-bold",
                        TIER_COLORS[tier].split(' ')[1]
                      )}>
                        {TIER_LABELS[tier]}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-zinc-500">
                        ({poisonsByTier[tier].length} pills)
                      </span>
                    </div>

                    {/* Poisons stack vertically - more compact */}
                    <div className="space-y-2">
                      {poisonsByTier[tier].length === 0 ? (
                        <p className="text-[10px] text-gray-400 dark:text-zinc-600 italic">
                          No {tier} pills
                        </p>
                      ) : (
                        poisonsByTier[tier].map((p) => {
                          const linkedQuestions = questions.filter(q => q.poisonId === p.id);
                          return (
                            <div
                              key={p.id}
                              className="relative p-2 rounded bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-700 hover:border-rose-400 dark:hover:border-rose-600 transition-colors group"
                            >
                              {/* Poison name - no tier badge needed */}
                              <p className="text-[10px] text-zinc-900 dark:text-zinc-200 font-semibold mb-1.5">{p.name}</p>

                              {/* False Claim Content - compact */}
                              <div className="mb-2">
                                <p className="text-[9px] text-zinc-600 dark:text-zinc-400 font-medium mb-0.5">False Claim:</p>
                                <p className="text-[10px] text-zinc-900 dark:text-zinc-200 leading-tight line-clamp-3">{p.content}</p>
                              </div>

                              {/* Linked Questions Count - collapsed by default */}
                              {linkedQuestions.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    {linkedQuestions.length} linked question{linkedQuestions.length > 1 ? 's' : ''}
                                  </p>
                                </div>
                              )}

                              {/* Markers - compact */}
                              {p.markers.length > 0 && (
                                <div className="mb-2">
                                  <div className="flex flex-wrap gap-0.5">
                                    {p.markers.slice(0, 3).map((marker, idx) => (
                                      <span
                                        key={idx}
                                        className="px-1 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[8px] border border-rose-500/20"
                                      >
                                        {marker}
                                      </span>
                                    ))}
                                    {p.markers.length > 3 && (
                                      <span className="text-[8px] text-zinc-500">
                                        +{p.markers.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Edit/Delete - compact */}
                              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingPoison(p);
                                    setIsAddingNew(false);
                                  }}
                                  className="p-0.5 rounded text-gray-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePoison(p.id)}
                                  className="p-0.5 rounded text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
