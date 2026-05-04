// middleware/validation.js
// 改用手動驗證，移除 express-validator 依賴

const validateCreatePost = [
  (req, res, next) => {
    const { post_text, post_type, visibility, tags } = req.body;
    if (!post_text || post_text.trim() === '')
      return res.status(400).json({ ok: false, errors: [{ msg: '貼文內容不得空白' }] });
    if (post_text.length > 5000)
      return res.status(400).json({ ok: false, errors: [{ msg: '貼文不得超過5000字' }] });
    if (!['letter', 'diary', 'normal', 'shared'].includes(post_type))
      return res.status(400).json({ ok: false, errors: [{ msg: '不合法的貼文類型' }] });
    next();
  }
];

const validateUpdatePost = [
  (req, res, next) => {
    const { post_text } = req.body;
    if (!post_text || post_text.trim() === '')
      return res.status(400).json({ ok: false, errors: [{ msg: '貼文內容不得空白' }] });
    next();
  }
];

const validatePostId = [
  (req, res, next) => {
    if (!Number.isInteger(Number(req.params.id)) || Number(req.params.id) < 1)
      return res.status(400).json({ ok: false, errors: [{ msg: '不合法的貼文 ID' }] });
    next();
  }
];

const validateCreateComment = [
  (req, res, next) => {
    const { post_id, comment_content } = req.body;
    if (!Number.isInteger(Number(post_id)) || Number(post_id) < 1)
      return res.status(400).json({ ok: false, errors: [{ msg: 'post_id 必須是正整數' }] });
    if (!comment_content || comment_content.trim() === '')
      return res.status(400).json({ ok: false, errors: [{ msg: '留言內容不得空白' }] });
    next();
  }
];

const validateCommentId = [
  (req, res, next) => {
    if (!Number.isInteger(Number(req.params.id)) || Number(req.params.id) < 1)
      return res.status(400).json({ ok: false, errors: [{ msg: '不合法的留言 ID' }] });
    next();
  }
];

const validateCommentIdParam = [
  (req, res, next) => {
    if (!Number.isInteger(Number(req.params.commentId)) || Number(req.params.commentId) < 1)
      return res.status(400).json({ ok: false, errors: [{ msg: '不合法的留言 ID' }] });
    next();
  }
];

const validateSharePost = [
  (req, res, next) => { next(); }
];

module.exports = {
  validateCreatePost,
  validateUpdatePost,
  validatePostId,
  validateCreateComment,
  validateCommentId,
  validateCommentIdParam,
  validateSharePost
};