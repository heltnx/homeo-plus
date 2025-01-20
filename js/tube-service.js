import { supabase } from './supabase-client.js';

export class TubeService {
    static async getLists() {
        const { data: lists, error: listsError } = await supabase
            .from('lists')
            .select('*')
            .order('created_at');

        if (listsError) throw listsError;
        return lists;
    }

    static async getTubes() {
        const { data: tubes, error: tubesError } = await supabase
            .from('tubes')
            .select('*')
            .order('name');

        if (tubesError) throw tubesError;
        return tubes;
    }

    static async createList(name) {
        const { data, error } = await supabase
            .from('lists')
            .insert([{ name }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async updateList(id, name) {
        const { error } = await supabase
            .from('lists')
            .update({ name })
            .eq('id', id);

        if (error) throw error;
    }

    static async deleteList(id) {
        const { error } = await supabase
            .from('lists')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    static async addTube(listId, name, usage, quantity) {
        const { error } = await supabase
            .from('tubes')
            .insert([{
                list_id: listId,
                name,
                usage: usage || null,
                quantity: parseInt(quantity)
            }]);

        if (error) throw error;
    }

    static async updateTube(id, name, usage, quantity) {
        console.log('Updating tube:', { id, name, usage, quantity });
        const { data, error } = await supabase
            .from('tubes')
            .update({
                name,
                usage: usage || null,
                quantity: parseInt(quantity)
            })
            .eq('id', id)
            .select();

        if (error) {
            console.error('Error updating tube:', error);
            throw error;
        }
        
        console.log('Update response:', data);
        return data;
    }

    static async deleteTube(id) {
        const { error } = await supabase
            .from('tubes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
}