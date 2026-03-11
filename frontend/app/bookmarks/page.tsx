"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  FolderPlus,
  Trash2,
  Globe,
  Lock,
  ChevronRight,
  FlaskConical,
} from "lucide-react";
import toast from "react-hot-toast";

interface BookmarkItem {
  id: string;
  entity_id: string;
  lab_name: string;
  created_at: string;
}

interface Collection {
  id: string;
  name: string;
  is_default: boolean;
  is_public: boolean;
  item_count: number;
  created_at: string;
}

export default function BookmarksPage() {
  const [activeTab, setActiveTab] = useState<"bookmarks" | "collections">("bookmarks");
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionItems, setCollectionItems] = useState<any[]>([]);
  const router = useRouter();

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    const token = getToken();
    if (!token) {
      toast.error("Please log in");
      router.push("/auth/login");
      return;
    }
    try {
      const res = await fetch(`/api/bookmarks/me?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      toast.error("Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  }, [page, router]);

  const fetchCollections = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/bookmarks/collections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data || []);
      }
    } catch {
      toast.error("Failed to load collections");
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
    fetchCollections();
  }, [fetchBookmarks, fetchCollections]);

  const removeBookmark = async (entityId: string) => {
    const token = getToken();
    const res = await fetch(`/api/bookmarks/${entityId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setBookmarks((prev) => prev.filter((b) => b.entity_id !== entityId));
      setTotal((prev) => prev - 1);
      toast.success("Bookmark removed");
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    const token = getToken();
    const res = await fetch("/api/bookmarks/collections", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCollectionName.trim() }),
    });
    if (res.ok) {
      setNewCollectionName("");
      setShowNewCollection(false);
      fetchCollections();
      toast.success("Collection created");
    }
  };

  const deleteCollection = async (id: string) => {
    if (!confirm("Delete this collection?")) return;
    const token = getToken();
    const res = await fetch(`/api/bookmarks/collections/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      fetchCollections();
      if (selectedCollection === id) setSelectedCollection(null);
      toast.success("Collection deleted");
    } else {
      const data = await res.json();
      toast.error(data.detail || "Failed to delete");
    }
  };

  const togglePublic = async (col: Collection) => {
    const token = getToken();
    const res = await fetch(`/api/bookmarks/collections/${col.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: !col.is_public }),
    });
    if (res.ok) {
      fetchCollections();
      toast.success(col.is_public ? "Collection set to private" : "Collection set to public");
    }
  };

  const openCollection = async (id: string) => {
    setSelectedCollection(id);
    const token = getToken();
    const res = await fetch(`/api/bookmarks/collections/${id}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setCollectionItems(data.items || []);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bookmark className="w-6 h-6 text-[#00FB75]" />
        Bookmarks
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(["bookmarks", "collections"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedCollection(null);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-[#00FB75] text-[#00FB75]"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bookmarks Tab */}
      {activeTab === "bookmarks" && (
        <div className="space-y-3">
          {loading && bookmarks.length === 0 && (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-2 border-[#00FB75] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && bookmarks.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No bookmarks yet</p>
              <p className="text-sm mt-1">
                Bookmark labs to save them for later reference.
              </p>
            </div>
          )}

          {bookmarks.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div
                className="flex items-center gap-3 cursor-pointer flex-1"
                onClick={() => router.push(`/labs/${b.entity_id}`)}
              >
                <FlaskConical className="w-5 h-5 text-[#00FB75]" />
                <div>
                  <p className="font-medium">{b.lab_name}</p>
                  <p className="text-xs text-gray-400">
                    Saved {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeBookmark(b.entity_id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove bookmark"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded border disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
                className="px-3 py-1 text-sm rounded border disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collections Tab */}
      {activeTab === "collections" && !selectedCollection && (
        <div className="space-y-3">
          <button
            onClick={() => setShowNewCollection(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#00FB75] border border-[#00FB75] rounded-lg hover:bg-[#00FB75]/10 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New Collection
          </button>

          {showNewCollection && (
            <div className="flex gap-2 items-center p-3 border rounded-lg border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name"
                className="flex-1 px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-transparent"
                onKeyDown={(e) => e.key === "Enter" && createCollection()}
              />
              <button
                onClick={createCollection}
                className="px-3 py-1.5 text-sm bg-[#00FB75] text-black rounded font-medium"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewCollection(false);
                  setNewCollectionName("");
                }}
                className="px-3 py-1.5 text-sm text-gray-500"
              >
                Cancel
              </button>
            </div>
          )}

          {collections.map((col) => (
            <div
              key={col.id}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div
                className="flex items-center gap-3 cursor-pointer flex-1"
                onClick={() => openCollection(col.id)}
              >
                <Bookmark className="w-5 h-5 text-[#00FB75]" />
                <div>
                  <p className="font-medium">
                    {col.name}
                    {col.is_default && (
                      <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {col.item_count} item{col.item_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => togglePublic(col)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title={col.is_public ? "Make private" : "Make public"}
                >
                  {col.is_public ? (
                    <Globe className="w-4 h-4 text-[#00FB75]" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </button>
                {!col.is_default && (
                  <button
                    onClick={() => deleteCollection(col.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete collection"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <ChevronRight
                  className="w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => openCollection(col.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collection Detail View */}
      {activeTab === "collections" && selectedCollection && (
        <div>
          <button
            onClick={() => setSelectedCollection(null)}
            className="text-sm text-[#00FB75] mb-4 hover:underline"
          >
            &larr; Back to collections
          </button>

          <h2 className="text-lg font-semibold mb-4">
            {collections.find((c) => c.id === selectedCollection)?.name || "Collection"}
          </h2>

          {collectionItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No items in this collection.</p>
          ) : (
            <div className="space-y-3">
              {collectionItems.map((item: any) => (
                <div
                  key={item.bookmark_id}
                  className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/labs/${item.entity_id}`)}
                >
                  <FlaskConical className="w-5 h-5 text-[#00FB75]" />
                  <div>
                    <p className="font-medium">{item.lab_name}</p>
                    <p className="text-xs text-gray-400">
                      Added {new Date(item.added_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
