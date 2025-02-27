const PhoneCall = require("../../model/schema/phoneCall");
const User = require("../../model/schema/user");
const mongoose = require("mongoose");

const add = async (req, res) => {
  try {
    const {
      sender,
      recipient,
      category,
      callDuration,
      startDate,
      endDate,
      callNotes,
      createBy,
      createByLead,
    } = req.body;

    if (createBy && !mongoose.Types.ObjectId.isValid(createBy)) {
      res.status(400).json({ error: "Invalid createBy value" });
    }
    if (createByLead && !mongoose.Types.ObjectId.isValid(createByLead)) {
      res.status(400).json({ error: "Invalid createByLead value" });
    }
    const phoneCall = {
      sender,
      category,
      recipient,
      callDuration,
      startDate,
      endDate,
      callNotes,
    };

    if (createBy) {
      phoneCall.createBy = createBy;
    }

    if (createByLead) {
      phoneCall.createByLead = createByLead;
    }

    const user = await User.findById({ _id: phoneCall.sender });
    user.outboundcall = user.outboundcall + 1;
    await user.save();

    const result = new PhoneCall(phoneCall);
    await result.save();
    res.status(200).json({ result });
  } catch (err) {
    console.error("Failed to create :", err);
    res.status(400).json({ err, error: "Failed to create" });
  }
};

const index = async (req, res) => {
  try {
    const query = req.query;
    if (query.sender) {
      query.sender = new mongoose.Types.ObjectId(query.sender);
    }
    let result = await PhoneCall.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "leads", // Assuming this is the collection name for 'leads'
          localField: "createByLead",
          foreignField: "_id",
          as: "createByrefLead",
        },
      },
      {
        $lookup: {
          from: "contacts",
          localField: "createBy",
          foreignField: "_id",
          as: "contact",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "users",
        },
      },
      { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },
      {
        $unwind: { path: "$createByrefLead", preserveNullAndEmptyArrays: true },
      },
      { $match: { "users.deleted": false } },
      {
        $addFields: {
          senderName: { $concat: ["$users.firstName", " ", "$users.lastName"] },
          deleted: {
            $cond: [
              { $eq: ["$contact.deleted", false] },
              "$contact.deleted",
              { $ifNull: ["$createByrefLead.deleted", false] },
            ],
          },
          createByName: {
            $cond: {
              if: "$contact",
              then: {
                $concat: [
                  "$contact.title",
                  " ",
                  "$contact.firstName",
                  " ",
                  "$contact.lastName",
                ],
              },
              else: { $concat: ["$createByrefLead.leadName"] },
            },
          },
        },
      },
      { $project: { contact: 0, createByrefLead: 0, users: 0 } },
    ]);

    res.status(200).json(result);
  } catch (err) {
    console.error("Failed :", err);
    res.status(400).json({ err, error: "Failed " });
  }
};

const view = async (req, res) => {
  try {
    let result = await PhoneCall.findOne({ _id: req.params.id });

    if (!result) return res.status(404).json({ message: "no Data Found." });

    let response = await PhoneCall.aggregate([
      { $match: { _id: result._id } },
      {
        $lookup: {
          from: "contacts",
          localField: "createBy",
          foreignField: "_id",
          as: "contact",
        },
      },
      {
        $lookup: {
          from: "leads", // Assuming this is the collection name for 'leads'
          localField: "createByLead",
          foreignField: "_id",
          as: "createByrefLead",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "users",
        },
      },
      { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$contact", preserveNullAndEmptyArrays: true } },
      {
        $unwind: { path: "$createByrefLead", preserveNullAndEmptyArrays: true },
      },
      { $match: { "users.deleted": false } },
      {
        $addFields: {
          senderName: { $concat: ["$users.firstName", " ", "$users.lastName"] },

          deleted: {
            $cond: [
              { $eq: ["$contact.deleted", false] },
              "$contact.deleted",
              { $ifNull: ["$createByrefLead.deleted", false] },
            ],
          },
          createByName: {
            $cond: {
              if: "$contact",
              then: {
                $concat: [
                  "$contact.title",
                  " ",
                  "$contact.firstName",
                  " ",
                  "$contact.lastName",
                ],
              },
              else: { $concat: ["$createByrefLead.leadName"] },
            },
          },
        },
      },
      { $project: { contact: 0, createByrefLead: 0, users: 0 } },
    ]);

    res.status(200).json(response[0]);
  } catch (err) {
    console.error("Failed :", err);
    res.status(400).json({ err, error: "Failed " });
  }
};

//view all calls api-------------------------
const viewAllCalls = async (req, res) => {
  try {
    let calls = await PhoneCall.find();

    if (!calls || calls.length === 0) {
      return res.status(404).json({ message: "No data found." });
    }

    let response = await PhoneCall.aggregate([
      {
        $lookup: {
          from: "contacts",
          localField: "createBy",
          foreignField: "_id",
          as: "contact",
        },
      },
      {
        $lookup: {
          from: "leads", // Assuming this is the collection name for 'leads'
          localField: "createByLead",
          foreignField: "_id",
          as: "createByrefLead",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "users",
        },
      },
      {
        $addFields: {
          senderName: {
            $concat: [
              { $arrayElemAt: ["$users.firstName", 0] },
              " ",
              { $arrayElemAt: ["$users.lastName", 0] },
            ],
          },
          recipientName: {
            $cond: {
              if: { $gt: [{ $size: "$contact" }, 0] },
              then: {
                $concat: [
                  { $arrayElemAt: ["$contact.firstName", 0] },
                  " ",
                  { $arrayElemAt: ["$contact.lastName", 0] },
                ],
              },
              else: {
                $cond: {
                  if: { $gt: [{ $size: "$createByrefLead" }, 0] },
                  then: { $arrayElemAt: ["$createByrefLead.leadName", 0] },
                  else: "",
                },
              },
            },
          },
        },
      },
      {
        $project: {
          users: 0,
          contact: 0,
          createByrefLead: 0,
        },
      },
    ]);

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
//view specific user's calls api-------------------------
const viewUserCalls = async (req, res) => {
  const sender = req.params.createBy;
  try {
    let calls = await PhoneCall.find();

    if (!calls || calls.length === 0) {
      return res.status(404).json({ message: "No data found." });
    }

    let response = await PhoneCall.aggregate([
      {
        $match: {
          sender: new mongoose.Types.ObjectId(sender),
        },
      },
      {
        $lookup: {
          from: "contacts",
          localField: "createBy",
          foreignField: "_id",
          as: "contact",
        },
      },
      {
        $lookup: {
          from: "leads", // Assuming this is the collection name for 'leads'
          localField: "createByLead",
          foreignField: "_id",
          as: "createByrefLead",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "users",
        },
      },
      {
        $addFields: {
          senderName: {
            $concat: [
              { $arrayElemAt: ["$users.firstName", 0] },
              " ",
              { $arrayElemAt: ["$users.lastName", 0] },
            ],
          },
          recipientName: {
            $cond: {
              if: { $gt: [{ $size: "$contact" }, 0] },
              then: {
                $concat: [
                  { $arrayElemAt: ["$contact.firstName", 0] },
                  " ",
                  { $arrayElemAt: ["$contact.lastName", 0] },
                ],
              },
              else: {
                $cond: {
                  if: { $gt: [{ $size: "$createByrefLead" }, 0] },
                  then: { $arrayElemAt: ["$createByrefLead.leadName", 0] },
                  else: "",
                },
              },
            },
          },
        },
      },
      {
        $project: {
          users: 0,
          contact: 0,
          createByrefLead: 0,
        },
      },
    ]);

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
module.exports = { add, index, view, viewAllCalls, viewUserCalls };
