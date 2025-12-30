"use client";

import { useEffect } from "react";

interface CommitDetail {
  sha: string;
  message: string;
  repository: string;
  url: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  timestamp: string;
}

interface PRDetail {
  number: number;
  title: string;
  repository: string;
  state: string;
  url: string;
  merged: boolean;
  createdAt: string;
  closedAt?: string;
  mergedAt?: string;
  comments: number;
  labels: string[];
}

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  commits: number;
  prs: number;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  repositories: string[];
  commitDetails: CommitDetail[];
  prDetails: PRDetail[];
  issues: number;
}

export default function ActivityModal({
  isOpen,
  onClose,
  date,
  commits,
  prs,
  linesAdded,
  linesDeleted,
  filesChanged,
  repositories,
  commitDetails,
  prDetails,
  issues,
}: ActivityModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Activity Details
              </h2>
              <p className="text-blue-100 text-sm">📅 {date}</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-gray-700/50">
          <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700">
            <div className="text-xs text-blue-400 mb-1">Commits</div>
            <div className="text-2xl font-bold text-blue-300">{commits}</div>
          </div>
          <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-700">
            <div className="text-xs text-purple-400 mb-1">Pull Requests</div>
            <div className="text-2xl font-bold text-purple-300">{prs}</div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-3 border border-green-700">
            <div className="text-xs text-green-400 mb-1">Lines Added</div>
            <div className="text-2xl font-bold text-green-300">
              +{linesAdded.toLocaleString()}
            </div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-3 border border-red-700">
            <div className="text-xs text-red-400 mb-1">Lines Deleted</div>
            <div className="text-2xl font-bold text-red-300">
              -{linesDeleted.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {/* Commits Column */}
          <div>
            <h3 className="text-lg font-bold text-gray-100 mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              Commits ({commits})
            </h3>
            <div className="space-y-3">
              {commitDetails.length > 0 ? (
                commitDetails.map((commit, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                      >
                        {commit.sha}
                      </a>
                      <span className="text-xs text-gray-400">
                        {formatTime(commit.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mb-2 line-clamp-2">
                      {commit.message}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 truncate">
                        📦 {commit.repository}
                      </span>
                      <div className="flex space-x-2">
                        <span className="text-green-400">
                          +{commit.additions}
                        </span>
                        <span className="text-red-400">
                          -{commit.deletions}
                        </span>
                        <span className="text-gray-400">
                          {commit.filesChanged} files
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-8">
                  No commits found
                </p>
              )}
            </div>
          </div>

          {/* Pull Requests Column */}
          <div>
            <h3 className="text-lg font-bold text-gray-100 mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              Pull Requests ({prs})
            </h3>
            <div className="space-y-3">
              {prDetails.length > 0 ? (
                prDetails.map((pr, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-purple-500 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 font-semibold text-sm flex-1"
                      >
                        #{pr.number} {pr.title}
                      </a>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          pr.merged
                            ? "bg-purple-900/40 text-purple-300"
                            : pr.state === "open"
                            ? "bg-green-900/40 text-green-300"
                            : "bg-red-900/40 text-red-300"
                        }`}
                      >
                        {pr.merged ? "Merged" : pr.state}
                      </span>
                      {pr.labels.slice(0, 2).map((label, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-300"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="truncate">📦 {pr.repository}</span>
                      <span>💬 {pr.comments}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-8">
                  No pull requests found
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {repositories.length > 0 && (
          <div className="border-t border-gray-700 px-6 py-4 bg-gray-900/50">
            <p className="text-sm text-gray-400">
              <span className="font-semibold text-gray-300">
                Repositories worked on:
              </span>{" "}
              {repositories.join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
