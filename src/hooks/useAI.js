import { useState, useCallback } from 'react';
import { generateReport, generateTriage } from '../lib/claude';
import { supabase } from '../lib/supabase';

/**
 * Hook for generating and saving AI reports.
 * Handles loading state, error handling, and DB persistence.
 */
export function useAI() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate an AI report and save it to the ai_reports table.
   *
   * @param {'rca'|'sprint_summary'|'deployment_note'|'test_summary'} type
   * @param {object} data - Source data for the prompt
   * @param {{ title: string, related_id?: string, related_type?: string }} meta
   * @returns {Promise<{id: string, content: string}|null>}
   */
  const generate = useCallback(async (type, data, meta) => {
    setGenerating(true);
    setError(null);
    try {
      const { content, error: aiError } = await generateReport(type, data);
      // generateReport always falls back to local templates so aiError should be rare
      if (aiError) throw new Error(aiError);
      if (!content) throw new Error('No content returned from AI');

      // Save to ai_reports table
      const { data: saved, error: dbError } = await supabase
        .from('ai_reports')
        .insert({
          type,
          title: meta.title,
          content,
          related_id: meta.related_id ?? null,
          related_type: meta.related_type ?? null,
          is_draft: true,
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);
      return saved;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  /**
   * Generate a report and update an existing record field (e.g., sprint.ai_summary).
   * Does NOT save a separate ai_reports row.
   * Falls back to local templates automatically if no API key is configured.
   *
   * @param {'rca'|'sprint_summary'|'deployment_note'|'test_summary'} type
   * @param {object} data
   * @returns {Promise<string|null>}
   */
  const generateInline = useCallback(async (type, data) => {
    setGenerating(true);
    setError(null);
    try {
      const { content, error: aiError } = await generateReport(type, data);
      // generateReport always falls back to local templates so aiError should be rare
      if (aiError) throw new Error(aiError);
      if (!content) throw new Error('No content returned from AI');
      return content;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const triage = useCallback(async (issues) => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: aiError } = await generateTriage(issues);
      if (aiError) throw new Error(aiError);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const triageSingle = useCallback(async (issue) => {
    setGenerating(true);
    setError(null);
    try {
      const { content, error: aiError } = await generateReport('triage_single', issue);
      if (aiError) throw new Error(aiError);
      
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }
      return JSON.parse(cleanContent);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  return { generate, generateInline, triage, triageSingle, generating, error };
}
