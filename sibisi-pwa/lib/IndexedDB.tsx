import { openDB } from 'idb';
import { Model } from './Model';

const DB_NAME = 'ModelDB';
const STORE_NAME = 'models';

export async function getDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

export async function saveModel(name: string, model: Model): Promise<void> {
    const db = await getDB();
    console.log("Saving model", name, model.toJSON());
    await db.put(STORE_NAME, model.toJSON(), name);
    console.log("Saved");
}


export async function loadModel(name: string): Promise<Model | null> {
    const db = await getDB();
    const raw = await db.get(STORE_NAME, name);
    return raw ? Model.fromJSON(raw) : null;
}

export async function getAllModelNames(): Promise<string[]> {
    const db = await getDB();
    return (await db.getAllKeys(STORE_NAME)) as string[];
}
