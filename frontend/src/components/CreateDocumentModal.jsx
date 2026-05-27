import { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import AISettingsModal from "./edit-document/AISettingsModal";
import Input from "./ui/Input";
import Button from "./ui/Button";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { Lightbulb, FileText, Sparkles } from "lucide-react";

function CreateDocumentModal({
  isOpen,
  onClose,
  onDocumentCreate,
  initialMode = "blank",
}) {
  const [documentTitle, setDocumentTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState(initialMode);
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);
  const [isCreating, setIsCreating] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    style: "Professional",
    tone: [],
    audience: "",
    format: "",
    length: "",
    extraInstructions: "",
  });

  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const resetModal = () => {
    setDocumentTitle("");
    setTopic("");
    setIsCreating(false);
    setMode(initialMode);
    setAiConfig({
      style: "Professional",
      tone: [],
      audience: "",
      format: "",
      length: "",
      extraInstructions: "",
    });

    setIsAISettingsOpen(false);
    setIsGenerating(false);
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  const handleCreateBlank = async () => {
  if (!documentTitle.trim()) {
    toast.error("Document title is required.");
    return;
  }

  setIsCreating(true);

  try {
    const {
      data: { document },
    } = await axiosInstance.post(
      API_ENDPOINTS.DOCUMENTS.CREATE,
      {
        title: documentTitle,
        subtitle: topic,
        content: "",
      }
    );

    toast.success("Document created successfully!");
    onDocumentCreate(document._id);
    handleClose();
  } catch (error) {
    console.error("Error creating document:", error);

    toast.error(
      error.response?.data?.message ||
      "Failed to create document."
    );
  } finally {
    setIsCreating(false);
  }
};


  const handleGenerateWithAI = async () => {
  if (!documentTitle.trim()) {
    toast.error("Document title is required.");
    return;
  }

  if (!topic.trim()) {
    toast.error("Tell AI what to create.");
    return;
  }

  setIsGenerating(true);

  const loadingToast = toast.loading(
    "Creating document with AI..."
  );

  try {
    const {
      data: { content },
    } = await axiosInstance.post(
      API_ENDPOINTS.AI.GENERATE_CONTENT,
      {
        action: "generate",
        documentTitle,
        documentDescription: topic,
        existingContent: "",
        customPrompt: "",
        aiConfig,
      }
    );

    const {
      data: { document },
    } = await axiosInstance.post(
      API_ENDPOINTS.DOCUMENTS.CREATE,
      {
        title: documentTitle,
        subtitle: topic,
        content,
      }
    );

    toast.dismiss(loadingToast);
    toast.success("Document created!");

    onDocumentCreate(document._id);
    handleClose();
  } catch (error) {
    console.error(error);

    toast.dismiss(loadingToast);

    toast.error(
      error.response?.data?.error ||
      "Failed to generate document."
    );
  } finally {
    setIsGenerating(false);
  }
};

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={
          mode === "ai"
            ? "Create Document with AI"
            : "Create New Document"
        }
      >
        <div className="space-y-5">
          <Input
            type="text"
            value={documentTitle}
            onChange={(event) => setDocumentTitle(event.target.value)}
            icon={FileText}
            label="Document Title"
            required
            placeholder="My new writing project"
          />

          <Input
            autoFocus={mode === "ai"}
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            icon={Lightbulb}
            label="What do you want to create?"
            placeholder="Write a startup pitch deck draft for an AI SaaS..."
          />



          <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
            {mode === "blank" && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateBlank}
                isLoading={isCreating}
              >
                Start Blank
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAISettingsOpen(true)}
            >
              AI Settings
            </Button>

            <Button
              type="button"
              onClick={handleGenerateWithAI}
              isLoading={isGenerating}
              icon={Sparkles}
            >
              Generate with AI
            </Button>
          </div>
        </div>

      </Modal>
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        aiConfig={aiConfig}
        setAiConfig={setAiConfig}
      />
    </>
  );
}

export default CreateDocumentModal;