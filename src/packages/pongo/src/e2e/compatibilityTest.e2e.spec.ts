import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import assert from 'assert';
import { Db as MongoDb, MongoClient as OriginalMongoClient } from 'mongodb';
import { after, before, describe, it } from 'node:test';
import { MongoClient, endAllPools, type Db } from '../';

type History = { street: string };
type Address = {
  city: string;
  street?: string;
  zip?: string;
  history?: History[];
};

type User = {
  name: string;
  age: number;
  address?: Address;
  tags?: string[];
};

void describe('MongoDB Compatibility Tests', () => {
  let postgres: StartedPostgreSqlContainer;
  let postgresConnectionString: string;
  let pongoClient: MongoClient;

  let mongo: StartedMongoDBContainer;
  let mongoConnectionString: string;
  let mongoClient: OriginalMongoClient;

  let pongoDb: Db;
  let mongoDb: MongoDb;

  before(async () => {
    postgres = await new PostgreSqlContainer().start();
    postgresConnectionString = postgres.getConnectionUri();
    pongoClient = new MongoClient(postgresConnectionString);
    await pongoClient.connect();

    mongo = await new MongoDBContainer('mongo:6.0.12').start();
    mongoConnectionString = mongo.getConnectionString();
    mongoClient = new OriginalMongoClient(mongoConnectionString, {
      directConnection: true,
    });
    await mongoClient.connect();

    const dbName = postgres.getDatabase();

    pongoDb = pongoClient.db(dbName);
    mongoDb = mongoClient.db(dbName);
  });

  after(async () => {
    try {
      await endAllPools();
      await postgres.stop();
    } catch (error) {
      console.log(error);
    }
    try {
      await mongoClient.close();
      await mongo.stop();
    } catch (error) {
      console.log(error);
    }
  });

  void describe('Insert Operations', () => {
    void it('should insert a document into both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const doc = { name: 'Anita', age: 25 };

      const pongoInsertResult = await pongoCollection.insertOne(doc);
      const mongoInsertResult = await mongoCollection.insertOne(doc);

      assert(pongoInsertResult.insertedId);
      assert(mongoInsertResult.insertedId);

      const pongoDoc = await pongoCollection.findOne({
        _id: pongoInsertResult.insertedId,
      });
      const mongoDoc = await mongoCollection.findOne({
        _id: mongoInsertResult.insertedId,
      });

      assert.deepStrictEqual(
        {
          name: pongoDoc!.name,
          age: pongoDoc!.age,
        },
        {
          name: mongoDoc!.name,
          age: mongoDoc!.age,
        },
      );
    });
  });

  void describe('Update Operations', () => {
    void it('should update a document in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');
      const doc = { name: 'Roger', age: 30 };

      const pongoInsertResult = await pongoCollection.insertOne(doc);
      const mongoInsertResult = await mongoCollection.insertOne(doc);

      const update = { $set: { age: 31 } };

      await pongoCollection.updateOne(
        { _id: pongoInsertResult.insertedId },
        update,
      );
      await mongoCollection.updateOne(
        { _id: mongoInsertResult.insertedId },
        update,
      );

      const pongoDoc = await pongoCollection.findOne({
        _id: pongoInsertResult.insertedId,
      });
      const mongoDoc = await mongoCollection.findOne({
        _id: mongoInsertResult.insertedId,
      });

      assert.deepStrictEqual(
        {
          name: pongoDoc!.name,
          age: 31,
        },
        {
          name: mongoDoc!.name,
          age: 31,
        },
      );
    });
  });

  void describe('Delete Operations', () => {
    void it('should delete a document from both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');
      const doc = { name: 'Cruella', age: 35 };

      const pongoInsertResult = await pongoCollection.insertOne(doc);
      const mongoInsertResult = await mongoCollection.insertOne(doc);

      await pongoCollection.deleteOne({ _id: pongoInsertResult.insertedId });
      await mongoCollection.deleteOne({ _id: mongoInsertResult.insertedId });

      const pongoDoc = await pongoCollection.findOne({
        _id: pongoInsertResult.insertedId,
      });
      const mongoDoc = await mongoCollection.findOne({
        _id: mongoInsertResult.insertedId,
      });

      assert.strictEqual(pongoDoc, null);
      assert.strictEqual(mongoDoc, null);
    });

    void it('should update a document in both PostgreSQL and MongoDB using $unset', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');
      const doc = { name: 'Roger', age: 30, address: { city: 'Wonderland' } };

      const pongoInsertResult = await pongoCollection.insertOne(doc);
      const mongoInsertResult = await mongoCollection.insertOne(doc);

      await pongoCollection.updateOne(
        { _id: pongoInsertResult.insertedId },
        { $unset: { address: '' } },
      );
      await mongoCollection.updateOne(
        { _id: mongoInsertResult.insertedId },
        { $unset: { address: '' } },
      );

      const pongoDoc = await pongoCollection.findOne({
        _id: pongoInsertResult.insertedId,
      });
      const mongoDoc = await mongoCollection.findOne({
        _id: mongoInsertResult.insertedId,
      });

      assert.deepStrictEqual(
        {
          name: pongoDoc!.name,
          age: pongoDoc!.age,
          address: undefined,
        },
        {
          name: mongoDoc!.name,
          age: mongoDoc!.age,
          address: undefined,
        },
      );
    });

    void it('should update a document in both PostgreSQL and MongoDB using $inc', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');
      const doc = { name: 'Roger', age: 30 };

      const pongoInsertResult = await pongoCollection.insertOne(doc);
      const mongoInsertResult = await mongoCollection.insertOne(doc);

      const update = { $inc: { age: 1 } };

      await pongoCollection.updateOne(
        { _id: pongoInsertResult.insertedId },
        update,
      );
      await mongoCollection.updateOne(
        { _id: mongoInsertResult.insertedId },
        update,
      );

      const pongoDoc = await pongoCollection.findOne({
        _id: pongoInsertResult.insertedId,
      });
      const mongoDoc = await mongoCollection.findOne({
        _id: mongoInsertResult.insertedId,
      });

      assert.deepStrictEqual(
        {
          name: pongoDoc!.name,
          age: 31,
        },
        {
          name: mongoDoc!.name,
          age: 31,
        },
      );
    });

    void it('should update a document in both PostgreSQL and MongoDB using $push', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');
      const doc = { name: 'Roger', age: 30, tags: ['tag1'] };

      const pongoInsertResult = await pongoCollection.insertOne(doc);
      const mongoInsertResult = await mongoCollection.insertOne(doc);

      await pongoCollection.updateOne(
        { _id: pongoInsertResult.insertedId },
        { $push: { tags: 'tag2' } },
      );
      await mongoCollection.updateOne(
        { _id: mongoInsertResult.insertedId },
        { $push: { tags: 'tag2' } },
      );

      const pongoDoc = await pongoCollection.findOne({
        _id: pongoInsertResult.insertedId,
      });
      const mongoDoc = await mongoCollection.findOne({
        _id: mongoInsertResult.insertedId,
      });

      assert.deepStrictEqual(
        {
          name: pongoDoc!.name,
          age: pongoDoc!.age,
          tags: ['tag1', 'tag2'],
        },
        {
          name: mongoDoc!.name,
          age: mongoDoc!.age,
          tags: ['tag1', 'tag2'],
        },
      );
    });
  });

  void describe('Find Operations', () => {
    void it('should find documents with a filter in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');
      const docs = [
        { name: 'David', age: 40 },
        { name: 'Eve', age: 45 },
        { name: 'Frank', age: 50 },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      const pongoDocs = await pongoCollection
        .find({ age: { $gte: 45 } })
        .toArray();
      const mongoDocs = await mongoCollection
        .find({ age: { $gte: 45 } })
        .toArray();

      assert.strictEqual(pongoDocs.length, 2);

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({ name: d.name, age: d.age })),
        mongoDocs.map((d) => ({ name: d.name, age: d.age })),
      );
    });

    void it('should find one document with a filter in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');
      const doc = { name: 'Grace', age: 55 };

      await pongoCollection.insertOne(doc);
      await mongoCollection.insertOne(doc);

      const pongoDoc = await pongoCollection.findOne({ name: 'Grace' });
      const mongoDoc = await mongoCollection.findOne({ name: 'Grace' });

      assert.deepStrictEqual(
        {
          name: pongoDoc!.name,
          age: pongoDoc!.age,
        },
        {
          name: mongoDoc!.name,
          age: mongoDoc!.age,
        },
      );
    });

    void it('should find documents with a nested property filter in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const docs = [
        {
          name: 'David',
          age: 40,
          address: { city: 'Dreamland', zip: '12345' },
        },
        { name: 'Eve', age: 45, address: { city: 'Wonderland', zip: '67890' } },
        {
          name: 'Frank',
          age: 50,
          address: { city: 'Nightmare', zip: '54321' },
        },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      const pongoDocs = await pongoCollection
        .find({ 'address.city': 'Wonderland' })
        .toArray();
      const mongoDocs = await mongoCollection
        .find({ 'address.city': 'Wonderland' })
        .toArray();

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
        mongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
      );
    });

    void it('should find documents with multiple nested property filters in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const docs = [
        {
          name: 'Anita',
          age: 25,
          address: { city: 'Wonderland', street: 'Main St' },
        },
        {
          name: 'Roger',
          age: 30,
          address: { city: 'Wonderland', street: 'Elm St' },
        },
        {
          name: 'Cruella',
          age: 35,
          address: { city: 'Dreamland', street: 'Oak St' },
        },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      const pongoDocs = await pongoCollection
        .find({ 'address.city': 'Wonderland', 'address.street': 'Elm St' })
        .toArray();
      const mongoDocs = await mongoCollection
        .find({ 'address.city': 'Wonderland', 'address.street': 'Elm St' })
        .toArray();

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
        mongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
      );
    });

    void it('should find documents with multiple nested property object filters in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const docs = [
        {
          name: 'Anita',
          age: 25,
          address: { city: 'Wonderland', street: 'Main St' },
        },
        {
          name: 'Roger',
          age: 30,
          address: { city: 'Wonderland', street: 'Elm St' },
        },
        {
          name: 'Cruella',
          age: 35,
          address: { city: 'Dreamland', street: 'Oak St' },
        },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      //const pongoDocs: User[] = [];
      const pongoDocs = await pongoCollection
        .find({ address: { city: 'Wonderland', street: 'Elm St' } })
        .toArray();
      const mongoDocs = await mongoCollection
        .find({ address: { city: 'Wonderland', street: 'Elm St' } })
        .toArray();

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
        mongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
      );
    });

    void it('should find documents with an array filter in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const docs = [
        { name: 'Anita', age: 25, tags: ['tag1', 'tag2'] },
        { name: 'Roger', age: 30, tags: ['tag2', 'tag3'] },
        { name: 'Cruella', age: 35, tags: ['tag1', 'tag3'] },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      const pongoDocs = await pongoCollection.find({ tags: 'tag1' }).toArray();
      const mongoDocs = await mongoCollection.find({ tags: 'tag1' }).toArray();

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({ name: d.name, age: d.age, tags: d.tags })),
        mongoDocs.map((d) => ({ name: d.name, age: d.age, tags: d.tags })),
      );
    });

    void it('should find documents with multiple array filters in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const docs = [
        { name: 'Anita', age: 25, tags: ['tag1', 'tag2'] },
        { name: 'Roger', age: 30, tags: ['tag2', 'tag3'] },
        { name: 'Cruella', age: 35, tags: ['tag1', 'tag3'] },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      const pongoDocs = await pongoCollection
        .find({ tags: { $all: ['tag1', 'tag2'] } })
        .toArray();
      const mongoDocs = await mongoCollection
        .find({ tags: { $all: ['tag1', 'tag2'] } })
        .toArray();

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({ name: d.name, age: d.age, tags: d.tags })),
        mongoDocs.map((d) => ({ name: d.name, age: d.age, tags: d.tags })),
      );
    });

    void it.skip('should find documents with an array element match filter in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const docs = [
        { name: 'Anita', age: 25, tags: ['tag1', 'tag2'] },
        { name: 'Roger', age: 30, tags: ['tag2', 'tag3'] },
        { name: 'Cruella', age: 35, tags: ['tag1', 'tag3'] },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      const pongoDocs = await pongoCollection
        .find({ tags: { $elemMatch: { $eq: 'tag1' } } })
        .toArray();
      const mongoDocs = await mongoCollection
        .find({ tags: { $elemMatch: { $eq: 'tag1' } } })
        .toArray();

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({ name: d.name, age: d.age, tags: d.tags })),
        mongoDocs.map((d) => ({ name: d.name, age: d.age, tags: d.tags })),
      );
    });

    void it('should find documents with a nested array element match filter in both PostgreSQL and MongoDB', async () => {
      const pongoCollection = pongoDb.collection<User>('testCollection');
      const mongoCollection = mongoDb.collection<User>('testCollection');

      const docs = [
        {
          name: 'Anita',
          age: 25,
          address: {
            city: 'Wonderland',
            zip: '12345',
            history: [{ street: 'Main St' }, { street: 'Elm St' }],
          },
        },
        {
          name: 'Roger',
          age: 30,
          address: {
            city: 'Wonderland',
            zip: '67890',
            history: [{ street: 'Main St' }, { street: 'Oak St' }],
          },
        },
        {
          name: 'Cruella',
          age: 35,
          address: {
            city: 'Dreamland',
            zip: '54321',
            history: [{ street: 'Elm St' }],
          },
        },
      ];

      await pongoCollection.insertOne(docs[0]!);
      await pongoCollection.insertOne(docs[1]!);
      await pongoCollection.insertOne(docs[2]!);

      await mongoCollection.insertOne(docs[0]!);
      await mongoCollection.insertOne(docs[1]!);
      await mongoCollection.insertOne(docs[2]!);

      const pongoDocs = await pongoCollection
        .find({ 'address.history': { $elemMatch: { street: 'Elm St' } } })
        .toArray();
      const mongoDocs = await mongoCollection
        .find({ 'address.history': { $elemMatch: { street: 'Elm St' } } })
        .toArray();

      assert.deepStrictEqual(
        pongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
        mongoDocs.map((d) => ({
          name: d.name,
          age: d.age,
          address: d.address,
        })),
      );
    });
  });
});
