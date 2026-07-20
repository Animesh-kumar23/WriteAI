import { BookOpen, Download, Lightbulb, Library } from "lucide-react";

export const FEATURES = [
  {
    title: "AI Writing Assistant",
    description:
      "Generate ideas, expand drafts, and get AI help when you're stuck.",
    icon: Lightbulb,
    bgGradientColors: "from-violet-500 to-purple-600",
    shadowColor: "shadow-violet-500/50",
  },
  {
    title: "Focused Writing Workspace",
    description:
      "A clean, distraction-free editor built for thinking, drafting, and editing.",
    icon: BookOpen,
    bgGradientColors: "from-blue-500 to-cyan-600",
    shadowColor: "shadow-blue-500/50",
  },
  {
    title: "Export & Download",
    description:
      "Download your work as PDF whenever you're ready.",
    icon: Download,
    bgGradientColors: "from-emerald-500 to-teal-600",
    shadowColor: "shadow-emerald-500/50",
  },
  {
    title: "Organized Projects",
    description:
      "Keep drafts, documents, and writing projects organized in one place.",
    icon: Library,
    bgGradientColors: "from-pink-500 to-rose-600",
    shadowColor: "shadow-pink-500/50",
  },
];
