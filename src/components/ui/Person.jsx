import Avatar from './Avatar'

export default function Person({ name }) {
  if (!name) return <span className="grey">Não atribuído</span>
  return (
    <span className="person">
      <Avatar name={name} size={26} />
      {name}
    </span>
  )
}
