import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/Toast';

export const useIssueLinkStore = create((set, get) => ({
  links: [],
  loading: false,
  error: null,

  fetchLinksForIssue: async (issueId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('issue_links')
        .select(`
          id,
          issue_id,
          linked_issue_id,
          link_type,
          created_at,
          issue:issues!issue_id(id, title, status),
          linked_issue:issues!linked_issue_id(id, title, status)
        `)
        .or(`issue_id.eq.${issueId},linked_issue_id.eq.${issueId}`);

      if (error) throw error;
      set({ links: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      toast.error(`Failed to load issue links: ${err.message}`);
    }
  },

  addLink: async (issueId, linkedIssueId, linkType) => {
    set({ loading: true, error: null });
    try {
      if (issueId === linkedIssueId) {
        throw new Error('Cannot link an issue to itself.');
      }

      const existing = get().links.find(
        (l) =>
          (l.issue_id === issueId && l.linked_issue_id === linkedIssueId) ||
          (l.issue_id === linkedIssueId && l.linked_issue_id === issueId)
      );
      if (existing) {
        throw new Error('These issues are already linked.');
      }

      const { data, error } = await supabase
        .from('issue_links')
        .insert({
          issue_id: issueId,
          linked_issue_id: linkedIssueId,
          link_type: linkType,
        })
        .select(`
          id,
          issue_id,
          linked_issue_id,
          link_type,
          created_at,
          issue:issues!issue_id(id, title, status),
          linked_issue:issues!linked_issue_id(id, title, status)
        `)
        .single();

      if (error) throw error;

      set((s) => ({
        links: [...s.links, data],
        loading: false,
      }));
      toast.success('Issues linked successfully');
      return { data };
    } catch (err) {
      set({ error: err.message, loading: false });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  removeLink: async (linkId) => {
    const prev = get().links;
    set((s) => ({
      links: s.links.filter((l) => l.id !== linkId),
    }));

    try {
      const { error } = await supabase
        .from('issue_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      toast.success('Link removed');
    } catch (err) {
      set({ links: prev, error: err.message });
      toast.error(`Failed to remove link: ${err.message}`);
    }
  },
}));
