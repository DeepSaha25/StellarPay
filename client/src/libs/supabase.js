import { createClient } from '@supabase/supabase-js';
import { validateAndSanitizeEmail } from '../utils/validation';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Add email to waitlist with validation
 * @param {string} email - Email to add to waitlist
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
export const addToWaitlist = async (email) => {
  try {
    // Validate and sanitize email
    const validation = validateAndSanitizeEmail(email);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const sanitizedEmail = validation.email;

    // Check if email already exists
    const existsCheck = await checkEmailExists(sanitizedEmail);
    if (existsCheck.exists) {
      return { success: false, error: 'Email already exists in waitlist' };
    }

    const { data: result, error } = await supabase
      .from('waitlist')
      .insert([
        {
          email: sanitizedEmail,
        }
      ])
      .select();

    if (error) {
      throw error;
    }
    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if email exists in waitlist with validation
 * @param {string} email - Email to check
 * @returns {Promise<{exists: boolean, error?: string}>}
 */
export const checkEmailExists = async (email) => {
  try {
    // Validate and sanitize email
    const validation = validateAndSanitizeEmail(email);
    if (!validation.isValid) {
      return { exists: false, error: validation.error };
    }

    const sanitizedEmail = validation.email;

    const { data, error } = await supabase
      .from('waitlist')
      .select('email')
      .eq('email', sanitizedEmail)
      .maybeSingle();

    if (error) { 
      throw error;
    }

    return { exists: !!data, error: null };
  } catch (error) {
    console.error('Error checking email:', error);
    return { exists: false, error: error.message };
  }
};

export const getWaitlistCount = async () => {
  try {
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return { count: count || 0, error: null };
  } catch (error) {
    console.error('Error getting waitlist count:', error);
    return { count: 0, error: error.message };
  }
};
