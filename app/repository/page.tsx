'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Header from '../components/Header';
import { Repository } from '../interfaces/RepositoryPage.interface';

function RepositoryContent() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [addingRepo, setAddingRepo] = useState<Set<number>>(new Set());
  const [togglingRepo, setTogglingRepo] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/repository');
      const data = await res.json();
      if (data.success) {
        setRepos(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch repositories');
      }
    } catch (err) {
      console.error('Error fetching repos:', err);
      setError('Failed to fetch repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRepoToggle = (repoId: number) => {
    setSelectedRepos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(repoId)) {
        newSet.delete(repoId);
      } else {
        newSet.add(repoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRepos.size === filteredRepos.length) {
      setSelectedRepos(new Set());
    } else {
      setSelectedRepos(new Set(filteredRepos.map((repo) => repo.id)));
    }
  };

  const handleSelectOrg = (orgKey: string) => {
    const orgRepos = groupedRepos[orgKey];
    const orgRepoIds = orgRepos.map((repo) => repo.id);
    const allSelected = orgRepoIds.every((id) => selectedRepos.has(id));

    setSelectedRepos((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        orgRepoIds.forEach((id) => newSet.delete(id));
      } else {
        orgRepoIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (selectedRepos.size === 0) {
      alert('Please select at least one repository to save.');
      return;
    }

    setSaving(true);
    try {
      const reposToSave = repos
        .filter((repo) => selectedRepos.has(repo.id))
        .map((repo) => ({
          ...repo,
          isActive: repo.isActive !== undefined ? repo.isActive : false,
        }));

      const res = await fetch('/api/repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repos: reposToSave }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh repos to update inDb status
        await fetchRepos();
        setSelectedRepos(new Set());
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error saving repos:', err);
      alert('Failed to save repositories. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRepo = async (repo: Repository) => {
    setAddingRepo((prev) => new Set(prev).add(repo.id));
    try {
      const res = await fetch('/api/repository/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...repo,
          isActive: false,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh repos to update inDb status
        await fetchRepos();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error adding repo:', err);
      alert('Failed to add repository. Please try again.');
    } finally {
      setAddingRepo((prev) => {
        const newSet = new Set(prev);
        newSet.delete(repo.id);
        return newSet;
      });
    }
  };

  const handleToggleActive = async (repo: Repository) => {
    const isInDb = repo.inDb === true || (repo.inDb !== false && repo._id);
    if (!isInDb) {
      alert('Repository must be in database before toggling active status.');
      return;
    }

    setTogglingRepo((prev) => new Set(prev).add(repo.id));
    try {
      const newActiveStatus = !repo.isActive;
      const res = await fetch('/api/repository/toggle-active', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: repo.fullName,
          isActive: newActiveStatus,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state immediately for better UX
        setRepos((prevRepos) => prevRepos.map((r) => (r.id === repo.id ? { ...r, isActive: newActiveStatus } : r)));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error toggling repo active status:', err);
      alert('Failed to toggle repository status. Please try again.');
    } finally {
      setTogglingRepo((prev) => {
        const newSet = new Set(prev);
        newSet.delete(repo.id);
        return newSet;
      });
    }
  };

  const filteredRepos = repos.filter((repo) => {
    const query = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      (repo.organization && repo.organization.toLowerCase().includes(query)) ||
      (repo.description && repo.description.toLowerCase().includes(query))
    );
  });

  // Group repos by organization for display
  const groupedRepos = filteredRepos.reduce((acc, repo) => {
    const orgKey = repo.organization || 'Personal';
    if (!acc[orgKey]) {
      acc[orgKey] = [];
    }
    acc[orgKey].push(repo);
    return acc;
  }, {} as Record<string, Repository[]>);

  const orgKeys = Object.keys(groupedRepos).sort((a, b) => {
    if (a === 'Personal') return -1;
    if (b === 'Personal') return 1;
    return a.localeCompare(b);
  });

  // Initialize expanded state when repos are loaded
  useEffect(() => {
    if (orgKeys.length > 0 && expandedOrgs.size === 0) {
      setExpandedOrgs(new Set(orgKeys));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgKeys.length]);

  const toggleOrg = (orgKey: string) => {
    setExpandedOrgs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orgKey)) {
        newSet.delete(orgKey);
      } else {
        newSet.add(orgKey);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedOrgs(new Set(orgKeys));
  };

  const collapseAll = () => {
    setExpandedOrgs(new Set());
  };

  const isExpanded = (orgKey: string) => expandedOrgs.has(orgKey);

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pb-12 sm:pb-16">
        <div className="space-y-4 sm:space-y-6">
          {/* Header Section */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-5 lg:p-6 border border-gray-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-100 mb-2 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  My Repositories
                </h2>
                <p className="text-sm sm:text-base text-gray-400 ml-14">
                  {loading
                    ? 'Loading repositories...'
                    : `${filteredRepos.length} repository${filteredRepos.length !== 1 ? 'ies' : ''} found`}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={fetchRepos}
                  disabled={loading}
                  className="bg-gradient-to-br from-blue-900/40 to-blue-800/40 hover:from-blue-900/50 hover:to-blue-800/50 rounded-lg px-5 py-2.5 border-2 border-blue-700/60 hover:border-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-semibold text-blue-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                >
                  <svg
                    className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || selectedRepos.size === 0}
                  className="bg-gradient-to-br from-green-900/40 to-green-800/40 hover:from-green-900/50 hover:to-green-800/50 rounded-lg px-5 py-2.5 border-2 border-green-700/60 hover:border-green-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-semibold text-green-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {saving ? 'Saving...' : `Save (${selectedRepos.size})`}
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="bg-gray-700/50 hover:bg-gray-700/70 rounded-lg px-5 py-2.5 border-2 border-gray-600/50 hover:border-gray-500 transition-all duration-200 text-sm sm:text-base font-semibold text-gray-200 shadow-sm hover:shadow-md"
                >
                  Back to Activity
                </button>
              </div>
            </div>
          </div>

          {/* Search and Select All */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-4 sm:p-5 lg:p-6 border border-gray-700/50">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search repositories by name, organization, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-700/60 border-2 border-gray-600/50 rounded-lg px-4 pl-11 py-2.5 sm:py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm sm:text-base transition-all shadow-sm"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="flex gap-2 sm:gap-3">
                {filteredRepos.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 hover:from-purple-900/50 hover:to-purple-800/50 rounded-lg px-4 py-2.5 sm:py-3 border-2 border-purple-700/60 hover:border-purple-600 transition-all duration-200 text-sm sm:text-base font-semibold text-purple-200 whitespace-nowrap shadow-sm hover:shadow-md"
                  >
                    {selectedRepos.size === filteredRepos.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                {orgKeys.length > 0 && (
                  <>
                    {expandedOrgs.size === orgKeys.length ? (
                      <button
                        onClick={collapseAll}
                        className="bg-gray-700/50 hover:bg-gray-700/70 rounded-lg px-4 py-2.5 sm:py-3 border-2 border-gray-600/50 hover:border-gray-500 transition-all duration-200 text-sm sm:text-base font-semibold text-gray-200 whitespace-nowrap shadow-sm hover:shadow-md"
                      >
                        Collapse All
                      </button>
                    ) : (
                      <button
                        onClick={expandAll}
                        className="bg-gray-700/50 hover:bg-gray-700/70 rounded-lg px-4 py-2.5 sm:py-3 border-2 border-gray-600/50 hover:border-gray-500 transition-all duration-200 text-sm sm:text-base font-semibold text-gray-200 whitespace-nowrap shadow-sm hover:shadow-md"
                      >
                        Expand All
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300">
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading repositories...</p>
            </div>
          )}

          {/* Repos List */}
          {!loading && !error && (
            <div className="space-y-4 sm:space-y-6">
              {orgKeys.length === 0 ? (
                <div className="bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 text-center">
                  <p className="text-gray-400">No repositories found.</p>
                </div>
              ) : (
                orgKeys.map((orgKey) => (
                  <div key={orgKey} className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-700/60 to-gray-700/40 px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-700/70 shadow-sm">
                      <div className="flex items-center justify-between gap-3 sm:gap-4">
                        <button
                          onClick={() => toggleOrg(orgKey)}
                          className="flex-1 text-left hover:opacity-90 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg sm:text-xl font-bold text-gray-100 mb-1">
                                {orgKey === 'Personal' ? (
                                  <span className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-blue-900/30 border border-blue-700/50">
                                      <svg
                                        className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                      </svg>
                                    </div>
                                    Personal Repositories
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-purple-900/30 border border-purple-700/50">
                                      <svg
                                        className="w-4 h-4 sm:w-5 sm:h-6 text-purple-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                        />
                                      </svg>
                                    </div>
                                    {orgKey}
                                  </span>
                                )}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-400 font-medium">
                                {groupedRepos[orgKey].length} repository{groupedRepos[orgKey].length !== 1 ? 'ies' : ''}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-600/30 group-hover:bg-gray-600/50 transition-colors">
                              <svg
                                className={`w-5 h-5 sm:w-6 sm:h-6 text-gray-300 transition-transform duration-200 flex-shrink-0 ${
                                  isExpanded(orgKey) ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOrg(orgKey);
                          }}
                          className="px-4 py-2 bg-gray-600/60 hover:bg-gray-600/80 rounded-lg border border-gray-500/50 text-xs sm:text-sm font-semibold text-gray-200 transition-all whitespace-nowrap shadow-sm hover:shadow-md"
                          title="Select/Deselect all repos in this organization"
                        >
                          {groupedRepos[orgKey].every((repo) => selectedRepos.has(repo.id))
                            ? 'Deselect All'
                            : 'Select All'}
                        </button>
                      </div>
                    </div>
                    {isExpanded(orgKey) && (
                      <div className="divide-y divide-gray-700">
                        {groupedRepos[orgKey].map((repo) => {
                          const isNotInDb = repo.inDb === false;
                          const isAdding = addingRepo.has(repo.id);
                          const isToggling = togglingRepo.has(repo.id);
                          const isInDb = repo.inDb === true || (repo.inDb !== false && repo._id); // More robust check
                          return (
                            <div
                              key={repo.id}
                              className={`px-4 py-4 sm:px-6 sm:py-5 hover:bg-gray-700/40 transition-all duration-200 border-l-4 ${
                                isNotInDb
                                  ? 'bg-yellow-900/10 border-yellow-600'
                                  : repo.isActive
                                  ? 'bg-gray-800/50 border-green-600/50'
                                  : 'bg-gray-800/30 border-gray-700'
                              }`}
                            >
                              <div className="flex items-start gap-4 sm:gap-5">
                                {/* Checkbox */}
                                <div className="flex-shrink-0 pt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedRepos.has(repo.id)}
                                    onChange={() => handleRepoToggle(repo.id)}
                                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 cursor-pointer transition-all hover:border-blue-500"
                                  />
                                </div>

                                {/* Repo Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-wrap mb-2">
                                    <a
                                      href={repo.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group text-base sm:text-lg font-semibold text-blue-400 hover:text-blue-300 transition-all flex items-center gap-2"
                                    >
                                      {repo.organization ? (
                                        <span>
                                          <span className="text-gray-400 font-medium">{repo.organization}</span>
                                          <span className="text-gray-500 mx-1">/</span>
                                          <span className="text-blue-400">{repo.name}</span>
                                        </span>
                                      ) : (
                                        <span>{repo.name}</span>
                                      )}
                                      <svg
                                        className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                        />
                                      </svg>
                                    </a>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {repo.private && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-700/80 text-gray-300 border border-gray-600/50 shadow-sm">
                                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                              fillRule="evenodd"
                                              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          Private
                                        </span>
                                      )}
                                      {isNotInDb && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-900/60 text-yellow-200 border border-yellow-700/50 shadow-sm">
                                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                              fillRule="evenodd"
                                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          Not in DB
                                        </span>
                                      )}
                                      {isInDb && (
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleToggleActive(repo);
                                          }}
                                          disabled={isToggling}
                                          className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-md ${
                                            repo.isActive
                                              ? 'bg-green-900/60 text-green-200 border-green-600/70 hover:bg-green-900/80 hover:border-green-500'
                                              : 'bg-gray-700/60 text-gray-300 border-gray-600/70 hover:bg-gray-700/80 hover:border-gray-500'
                                          }`}
                                          title={repo.isActive ? 'Click to deactivate' : 'Click to activate'}
                                        >
                                          {isToggling ? (
                                            <>
                                              <svg
                                                className="animate-spin h-3.5 w-3.5 mr-1.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                              >
                                                <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                                ></circle>
                                                <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                              </svg>
                                              {repo.isActive ? 'Deactivating...' : 'Activating...'}
                                            </>
                                          ) : (
                                            <>
                                              {repo.isActive ? (
                                                <>
                                                  <svg
                                                    className="w-3.5 h-3.5 mr-1.5"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                  >
                                                    <path
                                                      fillRule="evenodd"
                                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                      clipRule="evenodd"
                                                    />
                                                  </svg>
                                                  Active
                                                </>
                                              ) : (
                                                <>
                                                  <svg
                                                    className="w-3.5 h-3.5 mr-1.5"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                  >
                                                    <path
                                                      fillRule="evenodd"
                                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                      clipRule="evenodd"
                                                    />
                                                  </svg>
                                                  Inactive
                                                </>
                                              )}
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {repo.description && (
                                    <p className="text-sm sm:text-base text-gray-400 mt-2 mb-3 line-clamp-2 leading-relaxed">
                                      {repo.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-4 sm:gap-5 mt-3 text-xs sm:text-sm">
                                    {repo.language && (
                                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-700/40 text-gray-300">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></span>
                                        <span className="font-medium">{repo.language}</span>
                                      </span>
                                    )}
                                    {repo.stars > 0 && (
                                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-700/40 text-gray-300">
                                        <svg
                                          className="w-4 h-4 text-yellow-400"
                                          fill="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                        </svg>
                                        <span className="font-medium">{repo.stars.toLocaleString()}</span>
                                      </span>
                                    )}
                                    {repo.forks > 0 && (
                                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-700/40 text-gray-300">
                                        <svg
                                          className="w-4 h-4 text-purple-400"
                                          fill="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path d="M8 1a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H8zm0 9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H8zm0 9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H8z" />
                                        </svg>
                                        <span className="font-medium">{repo.forks.toLocaleString()}</span>
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-700/40 text-gray-400">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                      </svg>
                                      <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                                    </span>
                                  </div>
                                  {isNotInDb && (
                                    <div className="mt-4 pt-3 border-t border-gray-700/50">
                                      <button
                                        onClick={() => handleAddRepo(repo)}
                                        disabled={isAdding}
                                        className="px-4 py-2 bg-yellow-900/40 hover:bg-yellow-900/60 rounded-lg border-2 border-yellow-700/70 hover:border-yellow-600 text-sm font-semibold text-yellow-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
                                      >
                                        {isAdding ? (
                                          <>
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                              <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                              ></circle>
                                              <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                              ></path>
                                            </svg>
                                            Adding to Database...
                                          </>
                                        ) : (
                                          <>
                                            <svg
                                              className="w-4 h-4"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                              />
                                            </svg>
                                            Add to Database
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 sm:py-8 text-center text-gray-400 text-xs sm:text-sm px-4">
        <p>GitHub token is valid till 31st March 2026</p>
        <p>Built with Next.js, Tailwind CSS, GitHub API, MongoDB and Cursor</p>
      </footer>
    </div>
  );
}

export default function RepositoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <RepositoryContent />
    </Suspense>
  );
}
