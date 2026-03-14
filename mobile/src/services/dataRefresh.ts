type RefreshTopic = "transactions";

type RefreshListener = () => void;

const listenersByTopic: Record<RefreshTopic, Set<RefreshListener>> = {
  transactions: new Set<RefreshListener>(),
};

export function subscribeToRefresh(topic: RefreshTopic, listener: RefreshListener): () => void {
  listenersByTopic[topic].add(listener);
  return () => {
    listenersByTopic[topic].delete(listener);
  };
}

export function emitRefresh(topic: RefreshTopic): void {
  listenersByTopic[topic].forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("[refresh-bus] listener failed", error);
    }
  });
}

