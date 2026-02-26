import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Lock } from "lucide-react";
import { cn } from "@sarge/core";

export const metadata: Metadata = {
  title: "Apps",
};

interface AppCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badges: string[];
  href: string;
  status: "active" | "coming-soon";
}

const APPS: AppCard[] = [
  {
    id: "resume-tailor",
    title: "Resume Tailor",
    description: "Match your resume to any job posting in 3 AI-powered steps",
    icon: <FileText className="h-6 w-6 text-indigo-400" />,
    badges: ["Free"],
    href: "/apps/resume-tailor",
    status: "active",
  },
  {
    id: "interview-prep",
    title: "Interview Prep",
    description: "Practice common interview questions with AI feedback",
    icon: <Lock className="h-6 w-6 text-zinc-400" />,
    badges: ["Coming Soon"],
    href: "#",
    status: "coming-soon",
  },
  {
    id: "linkedin-optimizer",
    title: "LinkedIn Optimizer",
    description: "Optimize your LinkedIn profile for maximum visibility",
    icon: <Lock className="h-6 w-6 text-zinc-400" />,
    badges: ["Coming Soon"],
    href: "#",
    status: "coming-soon",
  },
  {
    id: "salary-coach",
    title: "Salary Negotiation Coach",
    description: "Get AI guidance on salary negotiation strategies",
    icon: <Lock className="h-6 w-6 text-zinc-400" />,
    badges: ["Coming Soon"],
    href: "#",
    status: "coming-soon",
  },
];

export default function AppsPage() {
  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-indigo-950/30 p-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-zinc-100 mb-2">📱 Apps</h1>
        <p className="text-lg text-zinc-400">
          Your productivity toolbox. AI-powered tools to accelerate your career.
        </p>
      </div>

      {/* App Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 flex-1">
        {APPS.map((app) => {
          const isActive = app.status === "active";
          return (
            <Link
              key={app.id}
              href={isActive ? app.href : "#"}
              className={isActive ? "block" : "pointer-events-none block"}
            >
              <div
                className={cn(
                  "rounded-xl border bg-zinc-900 p-6 transition-all duration-200",
                  isActive
                    ? "border-zinc-800 hover:border-indigo-500/60 hover:-translate-y-1 cursor-pointer"
                    : "border-zinc-800/50 opacity-60"
                )}
              >
                {/* Icon and Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      isActive ? "bg-indigo-500/10" : "bg-zinc-800/20"
                    )}
                  >
                    {app.icon}
                  </div>
                  <Badge
                    variant={isActive ? "secondary" : "outline"}
                    className={
                      isActive
                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                        : undefined
                    }
                  >
                    {app.badges[0]}
                  </Badge>
                </div>

                {/* Title and Description */}
                <h3 className="font-semibold text-zinc-100 mb-1">
                  {app.title}
                </h3>
                <p className="text-sm text-zinc-400 mb-4">{app.description}</p>

                {/* Button */}
                <Button
                  size="sm"
                  className={cn(
                    "w-full",
                    isActive
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                  disabled={!isActive}
                >
                  {isActive ? "Open" : "Coming Soon"}
                </Button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
