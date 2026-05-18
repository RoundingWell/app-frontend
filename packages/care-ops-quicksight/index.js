import * as QuicksightEmbedding from 'amazon-quicksight-embedding-sdk';

let embeddingContext;

async function getEmbeddingContext() {
  if (!embeddingContext) {
    embeddingContext = await QuicksightEmbedding.createEmbeddingContext();
  }
  return embeddingContext;
}

async function embedDashboard({ url, container, height = '100%', width = '100%' }) {
  const context = await getEmbeddingContext();
  return context.embedDashboard({ url, container, height, width });
}

export { getEmbeddingContext, embedDashboard };
