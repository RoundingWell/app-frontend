import * as QuicksightEmbedding from 'amazon-quicksight-embedding-sdk';

let embeddingContextPromise;

function getEmbeddingContext() {
  if (!embeddingContextPromise) {
    embeddingContextPromise = QuicksightEmbedding.createEmbeddingContext()
      .catch(err => {
        embeddingContextPromise = null;
        throw err;
      });
  }
  return embeddingContextPromise;
}

async function embedDashboard({ url, container, height = '100%', width = '100%' }) {
  const context = await getEmbeddingContext();
  return context.embedDashboard({ url, container, height, width });
}

export { getEmbeddingContext, embedDashboard };
