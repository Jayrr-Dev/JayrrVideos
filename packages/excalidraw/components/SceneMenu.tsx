import "./LibraryMenu.scss";

export const SceneMenu = () => {
  return (
    <div className="layer-ui__library">
      <div className="library-menu-items__no-items">
        <div className="library-menu-items__no-items__label">No scenes yet</div>
        <div className="library-menu-items__no-items__hint">
          Scenes you save will show up here.
        </div>
      </div>
    </div>
  );
};
