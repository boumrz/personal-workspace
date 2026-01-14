// Middleware to handle database-specific errors
export const handleDbError = (err, req, res, next) => {
  // PostgreSQL unique constraint violation
  if (err.code === "23505") {
    return res.status(409).json({ error: "Category with this name already exists" });
  }

  // Pass to next error handler if not a database error
  next(err);
};
