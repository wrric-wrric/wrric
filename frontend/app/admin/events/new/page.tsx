"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  MapPin,
  Globe,
  Users,
  Upload,
  X,
  Save,
  Eye,
  AlertCircle
} from 'lucide-react';
import { EventCategory } from '@/types/events';
import toast from 'react-hot-toast';

interface EventFormData {
  title: string;
  description: string;
  short_description: string;
  event_datetime: string;
  timezone: string;
  location_type: 'physical' | 'virtual' | 'hybrid';
  physical_location: string;
  virtual_link: string;
  registration_url: string;
  is_featured: boolean;
  priority: number;
  categories: string[];
}

export default function CreateEventPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    short_description: '',
    event_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location_type: 'physical',
    physical_location: '',
    virtual_link: '',
    registration_url: '',
    is_featured: false,
    priority: 0,
    categories: [],
  });
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
    'UTC',
  ];

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch('/api/admin/categories', {
          headers: {
            Authorization: `Bearer ${token || ''}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
          console.log('[CreateEvent] Categories loaded:', data);
        } else {
          console.warn('[CreateEvent] Failed to fetch categories:', response.status);
        }
      } catch (error) {
        console.error('[CreateEvent] Failed to fetch categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleImageUpload = (file: File, type: 'featured' | 'banner') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'featured') {
        setFeaturedImage(file);
        setPreviewImage(reader.result as string);
      } else {
        setBannerImage(file);
        setPreviewBanner(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (type: 'featured' | 'banner') => {
    if (type === 'featured') {
      setFeaturedImage(null);
      setPreviewImage(null);
    } else {
      setBannerImage(null);
      setPreviewBanner(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.short_description.trim()) newErrors.short_description = 'Short description is required';
    if (formData.short_description.length > 150) newErrors.short_description = 'Max 150 characters';
    if (!formData.event_datetime) newErrors.event_datetime = 'Date and time is required';

    const eventDate = new Date(formData.event_datetime);
    if (eventDate <= new Date()) newErrors.event_datetime = 'Event must be in the future';

    if (formData.location_type === 'physical' && !formData.physical_location.trim()) {
      newErrors.physical_location = 'Physical location is required for physical events';
    }

    if ((formData.location_type === 'virtual' || formData.location_type === 'hybrid') && !formData.virtual_link.trim()) {
      newErrors.virtual_link = 'Virtual link is required for virtual/hybrid events';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (publish: boolean = false) => {
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();

      // Append form data
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'categories' && Array.isArray(value)) {
          formDataToSend.append('categories', JSON.stringify(value));
        } else if (value !== null && value !== undefined) {
          formDataToSend.append(key, value.toString());
        }
      });

      formDataToSend.append('is_published', publish.toString());

      // Append images
      if (featuredImage) {
        formDataToSend.append('featured_image', featuredImage);
      }
      if (bannerImage) {
        formDataToSend.append('banner_image', bannerImage);
      }

      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = 'Failed to create event';

        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // FastAPI validation errors
            errorMessage = errorData.detail.map((err: any) => `${err.loc[err.loc.length - 1]}: ${err.msg}`).join(', ');
          } else if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      toast.success(publish ? 'Event created and published!' : 'Event saved as draft');

      if (publish) {
        router.push('/admin/events');
      } else {
        router.push(`/admin/events/${data.id}/edit`);
      }
    } catch (error: any) {
      console.error('Create event error:', error);
      toast.error(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b px-4 py-3 dark:bg-[#0A0A0A] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-[#00FB75]" />
            <span className="font-medium">Events</span>
            <span className="text-gray-500">/</span>
            <span className="dark:text-gray-400 text-gray-600">New Event</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="px-2.5 py-1 text-xs dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200 rounded-lg hover:border-[#00FB75]/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="px-2.5 py-1 text-xs dark:bg-[#121212] bg-white border dark:border-[#1A1A1A] border-gray-200 rounded-lg hover:border-[#00FB75]/50 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="px-2.5 py-1 text-xs font-medium bg-[#00FB75] text-black rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50"
            >
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Event Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none ${errors.title ? 'border-red-500' : ''}`}
                    placeholder="Event title"
                  />
                  {errors.title && (
                    <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.title}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Short Description * (Max 150)
                    <span className="text-gray-500 ml-2">{formData.short_description.length}/150</span>
                  </label>
                  <textarea
                    value={formData.short_description}
                    onChange={(e) => handleInputChange('short_description', e.target.value)}
                    maxLength={150}
                    rows={2}
                    className={`w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none resize-none ${errors.short_description ? 'border-red-500' : ''}`}
                    placeholder="Brief description"
                  />
                  {errors.short_description && (
                    <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.short_description}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Full Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={6}
                    className={`w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none ${errors.description ? 'border-red-500' : ''}`}
                    placeholder="Full event description"
                  />
                  {errors.description && (
                    <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Date & Time *</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.event_datetime}
                    onChange={(e) => handleInputChange('event_datetime', e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none ${errors.event_datetime ? 'border-red-500' : ''}`}
                  />
                  {errors.event_datetime && (
                    <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.event_datetime}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Location Type *</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['physical', 'virtual', 'hybrid'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleInputChange('location_type', type)}
                    className={`p-3 rounded-lg border text-xs font-medium transition-all ${formData.location_type === type
                      ? 'border-[#00FB75] bg-[#00FB75]/10 text-[#00FB75]'
                      : 'dark:border-[#1A1A1A] border-gray-200 hover:border-gray-600'
                      }`}
                  >
                    {type === 'physical' && <MapPin className="w-4 h-4 mx-auto mb-1" />}
                    {type === 'virtual' && <Globe className="w-4 h-4 mx-auto mb-1" />}
                    {type === 'hybrid' && <Users className="w-4 h-4 mx-auto mb-1" />}
                    <span className="capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            {(formData.location_type === 'physical' || formData.location_type === 'hybrid') && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3">Physical Location *</h3>
                <input
                  type="text"
                  value={formData.physical_location}
                  onChange={(e) => handleInputChange('physical_location', e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none ${errors.physical_location ? 'border-red-500' : ''}`}
                  placeholder="Venue address"
                />
                {errors.physical_location && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.physical_location}
                  </p>
                )}
              </div>
            )}

            {(formData.location_type === 'virtual' || formData.location_type === 'hybrid') && (
              <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
                <h3 className="text-sm font-bold mb-3">Virtual Link *</h3>
                <input
                  type="url"
                  value={formData.virtual_link}
                  onChange={(e) => handleInputChange('virtual_link', e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none ${errors.virtual_link ? 'border-red-500' : ''}`}
                  placeholder="https://meet.google.com/..."
                />
                {errors.virtual_link && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.virtual_link}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Registration URL</h3>
              <input
                type="url"
                value={formData.registration_url}
                onChange={(e) => handleInputChange('registration_url', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border dark:bg-[#0A0A0A] bg-gray-50 dark:border-[#1A1A1A] border-gray-200 focus:border-[#00FB75] focus:outline-none"
                placeholder="https://eventbrite.com/..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Event Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Featured Event</span>
                  <button
                    type="button"
                    onClick={() => handleInputChange('is_featured', !formData.is_featured)}
                    className={`w-10 h-5 rounded-full transition-colors ${formData.is_featured ? 'bg-[#00FB75]' : 'bg-[#1A1A1A]'
                      } flex items-center p-0.5`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.is_featured ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2">Priority (0-100)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.priority}
                      onChange={(e) => handleInputChange('priority', parseInt(e.target.value))}
                      className="flex-1 h-1 bg-[#1A1A1A] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#00FB75] [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="text-xs font-bold w-8">{formData.priority}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Categories</h3>
              {categoriesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-6 dark:bg-[#0A0A0A] bg-gray-50 rounded animate-pulse" />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <p className="text-xs text-gray-500">No categories available</p>
              ) : (
                <div className="space-y-2">
                  {categories.map(category => (
                    <label key={category.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.categories.includes(category.id)}
                        onChange={(e) => {
                          const newCategories = e.target.checked
                            ? [...formData.categories, category.id]
                            : formData.categories.filter(id => id !== category.id);
                          handleInputChange('categories', newCategories);
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="flex-1">{category.name}</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color_code }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Featured Image</h3>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center ${isDark ? 'dark:border-[#1A1A1A] border-gray-200' : 'border-gray-300'}`}>
                {previewImage ? (
                  <div className="relative">
                    <img src={previewImage} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-2" />
                    <button
                      onClick={() => removeImage('featured')}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70"
                    >
                      <X className="w-4 h-4 dark:text-white text-gray-900" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-gray-500 mb-2">Upload image</p>
                  </>
                )}
                <input
                  type="file"
                  id="featured-image"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload(e.target.files[0], 'featured');
                    }
                  }}
                />
                <label
                  htmlFor="featured-image"
                  className="inline-block px-3 py-1.5 text-xs bg-[#1A1A1A] rounded-lg hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                >
                  Choose Image
                </label>
              </div>
            </div>

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Banner Image</h3>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center ${isDark ? 'dark:border-[#1A1A1A] border-gray-200' : 'border-gray-300'}`}>
                {previewBanner ? (
                  <div className="relative">
                    <img src={previewBanner} alt="Banner Preview" className="w-full h-24 object-cover rounded-lg mb-2" />
                    <button
                      onClick={() => removeImage('banner')}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70"
                    >
                      <X className="w-4 h-4 dark:text-white text-gray-900" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-gray-500 mb-2">Upload banner</p>
                  </>
                )}
                <input
                  type="file"
                  id="banner-image"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload(e.target.files[0], 'banner');
                    }
                  }}
                />
                <label
                  htmlFor="banner-image"
                  className="inline-block px-3 py-1.5 text-xs bg-[#1A1A1A] rounded-lg hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                >
                  Choose Banner
                </label>
              </div>
            </div>

            <div className="rounded-lg border dark:bg-[#121212] bg-white p-4">
              <h3 className="text-sm font-bold mb-3">Preview</h3>
              <div className={`rounded-lg p-3 border ${isDark ? 'dark:border-[#1A1A1A] border-gray-200' : 'border-gray-300'}`}>
                <div className={`h-24 rounded mb-2 ${previewImage
                  ? 'bg-cover bg-center'
                  : isDark ? 'dark:bg-[#0A0A0A] bg-gray-50' : 'bg-gray-200'
                  }`}
                  style={previewImage ? { backgroundImage: `url(${previewImage})` } : {}}
                />
                <div className="text-xs font-bold line-clamp-2">{formData.title || 'Event Title'}</div>
                <div className="text-[10px] dark:text-gray-400 text-gray-600 line-clamp-2 mt-0.5">
                  {formData.short_description || 'Short description'}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {formData.event_datetime ? new Date(formData.event_datetime).toLocaleDateString() : 'Date TBD'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}