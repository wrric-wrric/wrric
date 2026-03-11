import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface FeedbackModalProps {
  showFeedbackModal: boolean;
  setShowFeedbackModal: (show: boolean) => void;
  feedbackText: string;
  setFeedbackText: (text: string) => void;
  handleFeedbackSubmit: () => void;
}

export default function FeedbackModal({
  showFeedbackModal,
  setShowFeedbackModal,
  feedbackText,
  setFeedbackText,
  handleFeedbackSubmit,
}: FeedbackModalProps) {
  return (
    <Dialog open={showFeedbackModal} onOpenChange={setShowFeedbackModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Feedback or Suggestions</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Your Name (Optional)"
            aria-label="Your name (optional)"
          />
          <input
            type="email"
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Your Email (Optional)"
            aria-label="Your email (optional)"
          />
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
            rows={4}
            placeholder="Share your thoughts or suggestions here..."
            aria-label="Enter your feedback"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowFeedbackModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleFeedbackSubmit}
            disabled={!feedbackText.trim()}
            className="bg-[#00FB75] text-black hover:bg-green-500"
          >
            Send Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}