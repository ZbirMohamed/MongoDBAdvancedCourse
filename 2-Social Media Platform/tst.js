let date = new Date().getDate() - 30;
let date2 = console.log(date2); // set Date is to set the day you're in

db.post.updateOne(
  { _id: "post2" },
  {
    $set: {
      likes: {
        $cond: {
          if: { $in: [userId, "$tags"] },
          then: { $setDifference: ["$tags", [userId]] },
          else: { $concatArrays: ["$tags", [userId]] },
        }
      }
    }
  }
);
