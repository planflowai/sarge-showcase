import { Metadata } from "next";
import { ResumeTailor } from "./components/ResumeTailor";

export const metadata: Metadata = {
  title: "Resume Tailor",
  description: "Tailor your resume to any job posting in 3 AI-powered steps",
};

export default function ResumeTailorPage() {
  return <ResumeTailor />;
}
