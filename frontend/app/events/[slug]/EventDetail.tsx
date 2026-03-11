"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Globe,
  Clock,
  ExternalLink,
  Share2,
  Facebook,
  Linkedin,
  Link as LinkIcon,
  ChevronLeft,
  Building,
  Star,
  Tag,
  ChevronRight,
  Video,
  Wifi,
  Bookmark,
  BookmarkCheck,
  X,
  CheckCircle2,
  Edit,
  Trash2,
  Users,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Event } from '@/types/events';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface EventDetailProps {
  event: Event;
}

export default function EventDetail({ event }: EventDetailProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = theme === 'dark';
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fix theme hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const getEventStatus = (): 'Available' | 'Closed' | 'Draft' => {
    if (!event.is_published) return 'Draft';
    
    const eventDate = new Date(event.event_datetime);
    const now = new Date();
    
    if (event.is_active !== undefined) {
      return event.is_active ? 'Available' : 'Closed';
    }
    
    if (eventDate > now) return 'Available';
    return 'Closed';
  };

  const eventStatus = getEventStatus();
  const [saved, setSaved] = useState(false);
  
  // Registration management states
  const [registrationStatus, setRegistrationStatus] = useState<any>(null);
  const [registrationData, setRegistrationData] = useState<any>(null); // Full registration details
  const [loadingRegistration, setLoadingRegistration] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'my-registration'>('overview');

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy · h:mm a');
    } catch {
      return 'Date TBD';
    }
  };

  const getEventTypeIcon = () => {
    switch (event.location_type) {
      case 'virtual':
        return <Video className="w-4 h-4" />;
      case 'hybrid':
        return <Wifi className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  // Fetch registration status on mount
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      try {
        console.log('[EventDetail] Fetching registration status for event ID:', event.id);
        const response = await fetch(`/api/events/${event.id}/registration-status`);
        console.log('[EventDetail] Registration status response:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[EventDetail] Registration status data:', JSON.stringify(data, null, 2));
          console.log('[EventDetail] Is registered?', data.registered);
          setRegistrationStatus(data);
          
          // If user is registered, fetch full registration details
          if (data.registered) {
            console.log('[EventDetail] User is registered, fetching full registration details...');
            const regResponse = await fetch(`/api/events/${event.id}/registrations/me`);
            if (regResponse.ok) {
              const regData = await regResponse.json();
              console.log('[EventDetail] Full registration data:', regData);
              setRegistrationData(regData);
              setEditFormData(regData);
            } else {
              console.error('[EventDetail] Failed to fetch registration details:', regResponse.status);
            }
          }
        } else {
          const errorData = await response.text();
          console.error('[EventDetail] Registration status error:', errorData);
        }
      } catch (error) {
        console.error("[EventDetail] Failed to check registration status:", error);
      } finally {
        setLoadingRegistration(false);
      }
    };

    const fetchParticipants = async () => {
      setParticipantsLoading(true);
      try {
        const response = await fetch(`/api/events/${event.id}/participants`);
        if (response.ok) {
          const data = await response.json();
          setParticipants(data.items || []);
        }
      } catch (error) {
        console.error("Failed to fetch participants:", error);
      } finally {
        setParticipantsLoading(false);
      }
    };

    checkRegistrationStatus();
    fetchParticipants();
  }, [event.id]);

  const handleEditRegistration = () => {
    console.log('[EventDetail] Opening edit modal with data:', editFormData);
    setShowEditModal(true);
  };

  const handleUpdateRegistration = async () => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/events/${event.id}/registrations/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        const updated = await response.json();
        setRegistrationData(updated); // Update the registration data
        setEditFormData(updated); // Update the form data for next edit
        setShowEditModal(false);
        toast.success('Registration updated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update registration');
      }
    } catch (error) {
      toast.error('An error occurred while updating');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelRegistration = async () => {
    setCancelling(true);
    try {
      const response = await fetch(`/api/events/${event.id}/registrations/me`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRegistrationStatus(null);
        setShowCancelDialog(false);
        toast.success('Registration cancelled successfully');
        // Refresh the page to show register button
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to cancel registration');
      }
    } catch (error) {
      toast.error('An error occurred while cancelling');
    } finally {
      setCancelling(false);
    }
  };

  const handleShare = async (platform?: 'facebook' | 'twitter' | 'linkedin' | 'x') => {
    const url = window.location.href;
    const title = event.title;
    const text = event.short_description;

    switch (platform) {
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'twitter':
      case 'x':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        break;
      default:
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success('Event link copied to clipboard!');
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error('Failed to copy link');
        }
        break;
    }
  };

  const handleSaveEvent = () => {
    setSaved(!saved);
    toast.success(saved ? 'Event removed from saved' : 'Event saved to your list');
  };

  // Prevent theme hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#0A0A0A] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b flex-shrink-0 ${isDark ? 'bg-[#0A0A0A]/80 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold truncate max-w-xs">{event.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEvent}
                className={`p-2 rounded-lg transition-colors ${
                  saved
                    ? 'text-[#00FB75]'
                    : isDark
                    ? 'hover:bg-gray-800'
                    : 'hover:bg-gray-100'
                }`}
              >
                {saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
              </button>
              <button
                onClick={() => handleShare()}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className={`border-b ${isDark ? 'border-gray-800 bg-[#0A0A0A]' : 'border-gray-200 bg-white'}`}>
        <div className="container mx-auto px-6">
          <div className="flex gap-6 max-w-4xl mx-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-[#00FB75] text-[#00FB75]'
                  : isDark
                  ? 'border-transparent text-gray-400 hover:text-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            
            <button
              onClick={() => setActiveTab('participants')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'participants'
                  ? 'border-[#00FB75] text-[#00FB75]'
                  : isDark
                  ? 'border-transparent text-gray-400 hover:text-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Participants {participants.length > 0 && `(${participants.length})`}
            </button>

            {/* Debug log */}
            {console.log('[EventDetail] Checking registration status for My Registration tab:', {
              registrationStatus,
              registered: registrationStatus?.registered,
              loading: loadingRegistration
            })}

            {registrationStatus?.registered && (
              <button
                onClick={() => setActiveTab('my-registration')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'my-registration'
                    ? 'border-[#00FB75] text-[#00FB75]'
                    : isDark
                    ? 'border-transparent text-gray-400 hover:text-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                My Registration
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
            <div className="relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0">
                {event.featured_image_url && !imageError ? (
                  <Image
                    src={event.featured_image_url}
                    alt={event.title}
                    fill
                    className="object-cover"
                    onError={() => setImageError(true)}
                    priority
                  />
                ) : (
                  <div className={`w-full h-full ${isDark ? 'bg-gradient-to-br from-gray-900 to-black' : 'bg-gradient-to-br from-gray-200 to-gray-300'}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-transparent" />
              </div>

              <div className="relative pt-32 pb-8 px-8">
                <div className="flex flex-wrap gap-2 mb-4">
                  {event.categories.slice(0, 3).map((category) => (
                    <span
                      key={category.id}
                      className="px-3 py-1 rounded-full text-xs font-medium border"
                      style={{
                        backgroundColor: `${category.color_code}20`,
                        color: category.color_code,
                        borderColor: `${category.color_code}40`
                      }}
                    >
                      {category.name}
                    </span>
                  ))}
                  {event.is_featured && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-500 to-orange-500 text-black">
                      Featured
                    </span>
                  )}
                </div>

                <h1 className="text-3xl md:text-4xl font-bold mb-4">
                  {event.title}
                </h1>

                <p className="text-lg opacity-80 mb-6 max-w-2xl">
                  {event.short_description}
                </p>

                <div className="flex flex-wrap gap-4 mb-6">
                  {loadingRegistration ? (
                    <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-800">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Checking registration...</span>
                    </div>
                  ) : registrationStatus?.registered ? (
                    <>
                      <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/20 border border-green-500/30">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="font-semibold text-green-600 dark:text-green-400">You&apos;re Registered!</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 capitalize">
                          {registrationStatus.status}
                        </span>
                      </div>
                      
                      {registrationStatus.available_actions?.includes('edit') && (
                        <button
                          onClick={handleEditRegistration}
                          className="bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Registration
                        </button>
                      )}
                      
                      {registrationStatus.available_actions?.includes('cancel') && (
                        <button
                          onClick={() => setShowCancelDialog(true)}
                          className="border border-red-500 text-red-500 font-semibold px-6 py-3 rounded-xl hover:bg-red-500 hover:text-white transition-colors inline-flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Cancel Registration
                        </button>
                      )}
                    </>
                  ) : (
                    <Link
                      href={`/events/${event.slug}/register`}
                      className="bg-[#00FB75] text-black font-semibold px-6 py-3 rounded-xl hover:bg-green-400 transition-colors inline-flex items-center gap-2"
                    >
                      Register Now
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className={`rounded-xl p-4 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <Calendar className="w-5 h-5 text-[#00FB75]" />
                  </div>
                  <div>
                    <p className="text-sm opacity-60">Date & Time</p>
                    <p className="font-medium">{formatDateTime(event.event_datetime)}</p>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-4 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <Clock className="w-5 h-5 text-[#00FB75]" />
                  </div>
                  <div>
                    <p className="text-sm opacity-60">Timezone</p>
                    <p className="font-medium">{event.timezone}</p>
                  </div>
                </div>
              </div>

              {event.physical_location && (
                <div className={`rounded-xl p-4 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <MapPin className="w-5 h-5 text-[#00FB75]" />
                    </div>
                    <div>
                      <p className="text-sm opacity-60">Location</p>
                      <p className="font-medium">{event.physical_location}</p>
                    </div>
                  </div>
                </div>
              )}

              {event.virtual_link && (
                <div className={`rounded-xl p-4 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <Video className="w-5 h-5 text-[#00FB75]" />
                    </div>
                    <div>
                      <p className="text-sm opacity-60">Virtual Access</p>
                      <p className="font-medium truncate max-w-[200px]">Link available</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`rounded-xl p-6 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
              <h2 className="text-lg font-semibold mb-4">About This Event</h2>
              <div 
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>

            <div className={`rounded-xl p-6 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
              <h2 className="text-lg font-semibold mb-4">Share This Event</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleShare('facebook')}
                  className={`p-3 rounded-lg transition-colors ${
                    isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Facebook className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleShare('x')}
                  className={`p-3 rounded-lg transition-colors ${
                    isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleShare('linkedin')}
                  className={`p-3 rounded-lg transition-colors ${
                    isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Linkedin className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleShare()}
                  className={`p-3 rounded-lg transition-colors ${
                    copied
                      ? 'bg-[#00FB75] text-black'
                      : isDark
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {copied ? 'Copied!' : <LinkIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
            </>
            )}

            {/* Participants Tab */}
            {activeTab === 'participants' && (
              <div>
                {participantsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-[#00FB75]" />
                  </div>
                ) : participants.length > 0 ? (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold mb-2">Event Participants</h2>
                      <p className="opacity-70">
                        {participants.length} {participants.length === 1 ? 'person has' : 'people have'} registered for this event
                      </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {participants.map((participant, idx) => (
                        <div 
                          key={idx}
                          className={`p-4 rounded-xl border ${isDark ? 'bg-[#1A1A1A] border-gray-800' : 'bg-white border-gray-200'}`}
                        >
                          <h3 className="font-semibold mb-1">
                            {participant.first_name} {participant.last_name}
                          </h3>
                          {participant.position && participant.organization && (
                            <p className="text-sm opacity-70 mb-2">
                              {participant.position} at {participant.organization}
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-xs px-2 py-1 rounded-full bg-[#00FB75]/20 text-[#00FB75] capitalize">
                              {participant.participation_type}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-500 capitalize">
                              {participant.attendance_type?.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl p-12 text-center ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-semibold mb-2">No Participants Yet</h3>
                    <p className="opacity-70">Be the first to register for this event!</p>
                  </div>
                )}
              </div>
            )}

            {/* My Registration Tab */}
            {activeTab === 'my-registration' && registrationStatus?.registered && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">My Registration</h2>
                  <p className="opacity-70">Manage your registration for this event</p>
                </div>

                <div className={`rounded-xl p-6 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold">Registration Details</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm opacity-70">Status:</span>
                        <span className={`text-xs px-3 py-1 rounded-full capitalize ${
                          registrationStatus.status === 'approved' 
                            ? 'bg-green-500/20 text-green-500'
                            : registrationStatus.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-gray-500/20 text-gray-500'
                        }`}>
                          {registrationStatus.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {registrationStatus.available_actions?.includes('edit') && (
                        <button
                          onClick={handleEditRegistration}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      {registrationStatus.available_actions?.includes('cancel') && (
                        <button
                          onClick={() => setShowCancelDialog(true)}
                          className="border border-red-500 text-red-500 px-4 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors inline-flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm opacity-70 mb-1 block">Name</label>
                      <p className="font-medium">
                        {registrationData?.first_name} {registrationData?.last_name}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm opacity-70 mb-1 block">Email</label>
                      <p className="font-medium">{registrationData?.email}</p>
                    </div>
                    {registrationData?.position && (
                      <div>
                        <label className="text-sm opacity-70 mb-1 block">Position</label>
                        <p className="font-medium">{registrationData.position}</p>
                      </div>
                    )}
                    {registrationData?.organization && (
                      <div>
                        <label className="text-sm opacity-70 mb-1 block">Organization</label>
                        <p className="font-medium">{registrationData.organization}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm opacity-70 mb-1 block">Participation Type</label>
                      <p className="font-medium capitalize">{registrationData?.participation_type?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="text-sm opacity-70 mb-1 block">Attendance Type</label>
                      <p className="font-medium capitalize">{registrationData?.attendance_type?.replace('_', ' ')}</p>
                    </div>
                    {registrationData?.special_requirements && (
                      <div className="md:col-span-2">
                        <label className="text-sm opacity-70 mb-1 block">Special Requirements</label>
                        <p className="font-medium">{registrationData.special_requirements}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm opacity-70 mb-1 block">Registration Date</label>
                      <p className="font-medium">
                        {registrationData?.created_at && format(new Date(registrationData.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Participants Section - REMOVED, moved to tab */}
            {/* {participants.length > 0 && (
              <div className={`rounded-xl p-6 ${isDark ? 'bg-[#1A1A1A] border border-gray-800' : 'bg-white border'}`}>
                ...
              </div>
            )} */}
          </div>
        </div>
      </div>

      {/* Edit Registration Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6 ${isDark ? 'bg-[#0A0A0A] border border-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Edit Registration</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">First Name</label>
                  <input
                    type="text"
                    value={editFormData.first_name || ''}
                    onChange={(e) => setEditFormData({...editFormData, first_name: e.target.value})}
                    className={`w-full p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Last Name</label>
                  <input
                    type="text"
                    value={editFormData.last_name || ''}
                    onChange={(e) => setEditFormData({...editFormData, last_name: e.target.value})}
                    className={`w-full p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Position</label>
                <input
                  type="text"
                  value={editFormData.position || ''}
                  onChange={(e) => setEditFormData({...editFormData, position: e.target.value})}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Organization</label>
                <input
                  type="text"
                  value={editFormData.organization || ''}
                  onChange={(e) => setEditFormData({...editFormData, organization: e.target.value})}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Attendance Type</label>
                <select
                  value={editFormData.attendance_type || 'on_site'}
                  onChange={(e) => setEditFormData({...editFormData, attendance_type: e.target.value})}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                >
                  <option value="on_site">On-site</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Special Requirements</label>
                <textarea
                  value={editFormData.special_requirements || ''}
                  onChange={(e) => setEditFormData({...editFormData, special_requirements: e.target.value})}
                  rows={3}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateRegistration}
                  disabled={updating}
                  className="flex-1 bg-[#00FB75] text-black font-semibold px-6 py-3 rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Registration'
                  )}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={updating}
                  className="px-6 py-3 rounded-lg border dark:border-gray-700 border-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Registration Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-[#0A0A0A] border border-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-500/20">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-xl font-bold">Cancel Registration?</h2>
            </div>

            <p className="opacity-70 mb-6">
              Are you sure you want to cancel your registration for this event? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelRegistration}
                disabled={cancelling}
                className="flex-1 bg-red-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel Registration'
                )}
              </button>
              <button
                onClick={() => setShowCancelDialog(false)}
                disabled={cancelling}
                className="px-6 py-3 rounded-lg border dark:border-gray-700 border-gray-300 hover:bg-gray-800 transition-colors"
              >
                Keep Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}