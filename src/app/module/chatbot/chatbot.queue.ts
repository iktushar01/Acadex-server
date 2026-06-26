type JobHandler = () => Promise<void>;

class InProcessJobQueue {
  private readonly queue: JobHandler[] = [];
  private running = 0;

  constructor(private readonly concurrency: number) {}

  enqueue(handler: JobHandler): void {
    this.queue.push(handler);
    void this.drain();
  }

  private async drain(): Promise<void> {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;

      this.running += 1;
      job()
        .catch((error) => {
          console.error("[ChatbotQueue] Job failed:", error);
        })
        .finally(() => {
          this.running -= 1;
          void this.drain();
        });
    }
  }
}

export const chatbotJobQueue = new InProcessJobQueue(2);

export const enqueueChatbotJob = (handler: JobHandler): void => {
  chatbotJobQueue.enqueue(handler);
};
