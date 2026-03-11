import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LabProfile } from "../../lib/types";

interface BroadcastInquiryModalProps {
  showBroadcastModal: boolean;
  setShowBroadcastModal: (show: boolean) => void;
  inquiryText: string;
  setInquiryText: (text: string) => void;
  handleBroadcastSubmit: () => void;
  selectedLabs: string[];
  displayData: LabProfile[];
}

export default function BroadcastInquiryModal({
  showBroadcastModal,
  setShowBroadcastModal,
  inquiryText,
  setInquiryText,
  handleBroadcastSubmit,
  selectedLabs,
  displayData,
}: BroadcastInquiryModalProps) {
  const selectedLabNames = displayData
    .filter((lab) => selectedLabs.includes(lab.id.toString()))
    .map((lab) => lab.university || lab.display_name);

  return (
    <Dialog open={showBroadcastModal} onOpenChange={setShowBroadcastModal}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Broadcast Inquiry to Selected Labs</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="mb-3">
            <h6>Selected Labs:</h6>
            <ul className="list-group">
              {selectedLabNames.map((name, index) => (
                <li key={index} className="list-group-item">
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <textarea
            value={inquiryText}
            onChange={(e) => setInquiryText(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2"
            rows={4}
            placeholder="e.g., I need more details about your solar research facilities..."
            aria-label="Enter your broadcast inquiry"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowBroadcastModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBroadcastSubmit}
            disabled={!inquiryText.trim() || selectedLabs.length === 0}
            className="bg-[#00FB75] text-black hover:bg-green-500"
          >
            Send Broadcast Inquiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}