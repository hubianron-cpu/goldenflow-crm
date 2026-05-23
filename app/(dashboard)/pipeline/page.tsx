import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { SectionHeader } from "@/components/section-header";

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="SALES FLOW"
        title="מסלול המכירה"
        description="מעקב מהיר אחר שלבי המכירה, שווי העסקאות והתקדמות כל ליד בלחיצה אחת."
      />
      <PipelineBoard />
    </div>
  );
}
