import { useState, useEffect, useCallback } from 'react';
import { demands as demandsApi } from '../services/api';

export function useDemands(filters = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await demandsApi.list(filters);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = useCallback(async (id, status) => {
    await demandsApi.updateStatus(id, status);
    await load();
  }, [load]);

  const grouped = {
    backlog: data.filter(d => d.status === 'backlog'),
    sprint_backlog: data.filter(d => d.status === 'sprint_backlog'),
    em_progresso: data.filter(d => d.status === 'em_progresso'),
    em_revisao: data.filter(d => d.status === 'em_revisao'),
    concluido: data.filter(d => d.status === 'concluido'),
  };

  return { demands: data, grouped, loading, error, reload: load, updateStatus };
}
