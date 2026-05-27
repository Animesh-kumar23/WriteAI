const { connectToDB } = require("../configs/db");
const Document = require("../models/document");
const DocumentChunk = require("../models/DocumentChunk");

async function migrate() {
  await connectToDB();

  const documents = await Document.find({});

  let fixed = 0;

  for (const doc of documents) {
    const chunkCount = await DocumentChunk.countDocuments({
      documentId: doc._id,
    });

    if (chunkCount === 0) {
      await DocumentChunk.create({
        documentId: doc._id,
        order: 0,
        content: "",
      });

      fixed++;
      console.log(`Created empty chunk for ${doc.title}`);
    }
  }

  console.log({ fixed });
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});