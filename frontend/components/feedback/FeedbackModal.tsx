"use client";

import { useState } from "react";

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ message: string, success: boolean } | null>(null);

  const openModal = () => {
    setFeedback("");
    setData(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) {
      setData({ message: "Please enter feedback.", success: false });
      return;
    }

    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("user_id") || "Guest"

    // if (!token || !userId) {
    //   setData({ error: "Please log in to submit feedback." });
      // window.location.href = "/login";
    //   return;
    // }

    setLoading(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          name: name || null,
          email: email || null,
          feedback,
        }),
      });

      const data = await response.json();

      console.log("Feedback submission response:", data);

      if (!response.ok) {
        throw new Error(data.detail || "Failed to submit feedback");
      }

      setData(data || "Feedback submitted successfully");
      setTimeout(() => closeModal(), 2000);
    } catch (err: any) {
      setData(err || "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <button
        onClick={openModal}
        title="Send feedback or suggestions"
        className="fixed bottom-6 right-6 bg-[#00FB75] text-white p-4 rounded-full shadow-lg hover:bg-green-700"
      >
        💬
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-sidebar rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center border-b p-4">
              <h2 className="text-lg font-semibold">
                Send Feedback or Suggestions
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                ✖
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Your Name (Optional)</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Your Email (Optional)</label>
                <input
                  type="email"
                  className="w-full border rounded-lg p-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Your Feedback</label>
                <textarea
                  className="w-full border rounded-lg p-2"
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your thoughts or suggestions here..."
                />
              </div>

              {data?.success ? (
                <p className="text-sm text-center text-green-500 font-bold">{data.message}</p>
              ) : (
                data && <p className="text-sm text-center text-red-500 bold">{data.message}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-lg bg-red-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!feedback.trim() || loading}
                  className="px-4 py-2 bg-[#00FB75] text-black rounded-lg disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
