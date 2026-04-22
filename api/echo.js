module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  res.status(200).json({
    method: req.method,
    headers: req.headers,
    bodyRaw: req.body,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body || {}),
    clinicName: req.body?.clinicName,
    clinicNameType: typeof req.body?.clinicName,
    clinicNameLength: req.body?.clinicName?.length,
    password: req.body?.password,
    passwordType: typeof req.body?.password
  });
};
