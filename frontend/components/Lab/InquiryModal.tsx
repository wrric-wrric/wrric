import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface InquiryModalProps {
  showInquiryModal: boolean;
  setShowInquiryModal: (show: boolean) => void;
  inquiryText: string;
  setInquiryText: (text: string) => void;
  handleInquirySubmit: () => void;
  labId: string | null;
}

export default function InquiryModal({
  showInquiryModal,
  setShowInquiryModal,
  inquiryText,
  setInquiryText,
  handleInquirySubmit,
  labId,
}: InquiryModalProps) {
  return (
    <Dialog open={showInquiryModal} onOpenChange={setShowInquiryModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Contact for More Information</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <textarea
            value={inquiryText}
            onChange={(e) => setInquiryText(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
            rows={4}
            placeholder="e.g., I need more details about the solar research facilities..."
            aria-label="Enter your inquiry"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowInquiryModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInquirySubmit}
            disabled={!inquiryText.trim() || !labId}
            className="bg-[#00FB75] text-black hover:bg-green-500"
          >
            Send Inquiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}