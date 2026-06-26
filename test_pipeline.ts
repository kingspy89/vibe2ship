import { runAgent2 } from './server/pipeline';
async function test() {
  try {
    await runAgent2("Test description", 12.93, 77.62, "pothole");
    console.log("Success!");
    process.exit(0);
  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
test();
